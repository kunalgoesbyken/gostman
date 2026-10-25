package engine

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	authOAuth2 = "oauth2"

	GrantClientCredentials = "client_credentials"
	GrantPassword          = "password"
	GrantAuthorizationCode = "authorization_code"
	GrantDeviceCode        = "device_code"
	grantRefreshToken      = "refresh_token"
	deviceGrantType        = "urn:ietf:params:oauth:grant-type:device_code"
	errorPending           = "authorization_pending"
	errorSlowDown          = "slow_down"

	credentialsInBody   = "body"
	defaultTokenPrefix  = "Bearer"
	challengeMethodS256 = "S256"
	randomTokenBytes    = 32
)

type Authorization struct {
	URL          string `json:"url"`
	State        string `json:"state"`
	CodeVerifier string `json:"codeVerifier"`
	RedirectURI  string `json:"redirectUri"`
	Issuer       string `json:"issuer"`
}

type TokenExchange struct {
	Config       OAuth2  `json:"config"`
	Variables    string  `json:"variables"`
	Options      Options `json:"options"`
	Code         string  `json:"code"`
	CodeVerifier string  `json:"codeVerifier"`
	RedirectURI  string  `json:"redirectUri"`
	Refresh      bool    `json:"refresh"`
	DeviceCode   string  `json:"deviceCode"`
}

type Token struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	IDToken      string `json:"idToken"`
	ExpiresAt    int64  `json:"expiresAt"`
	Error        string `json:"error"`
	Pending      bool   `json:"pending,omitempty"`
	SlowDown     bool   `json:"slowDown,omitempty"`
}

type tokenPayload struct {
	AccessToken      string      `json:"access_token"`
	RefreshToken     string      `json:"refresh_token"`
	IDToken          string      `json:"id_token"`
	ExpiresIn        json.Number `json:"expires_in"`
	Error            string      `json:"error"`
	ErrorDescription string      `json:"error_description"`
}

func randomToken() (string, error) {
	buffer := make([]byte, randomTokenBytes)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func StartAuthorization(config OAuth2, variables string) (Authorization, error) {
	expansion, err := newSubstitution(variables)
	if err != nil {
		return Authorization{}, err
	}
	substitute := expansion.apply

	target, err := url.Parse(strings.TrimSpace(substitute(config.AuthURL)))
	if err != nil || target.Host == "" || (target.Scheme != "http" && target.Scheme != "https") {
		return Authorization{}, fmt.Errorf("enter the authorization URL of the provider, starting with https://")
	}
	state, err := randomToken()
	if err != nil {
		return Authorization{}, err
	}
	started := Authorization{State: state, RedirectURI: strings.TrimSpace(substitute(config.CallbackURL)), Issuer: strings.TrimSpace(substitute(config.Issuer))}

	query := target.Query()
	query.Set("response_type", "code")
	query.Set("client_id", substitute(config.ClientID))
	query.Set("redirect_uri", started.RedirectURI)
	query.Set("state", state)
	if scope := strings.TrimSpace(substitute(config.Scope)); scope != "" {
		query.Set("scope", scope)
	}
	if resource := strings.TrimSpace(substitute(config.Resource)); resource != "" {
		query.Set("resource", resource)
	}
	if config.PKCE {
		if started.CodeVerifier, err = randomToken(); err != nil {
			return Authorization{}, err
		}
		challenge := sha256.Sum256([]byte(started.CodeVerifier))
		query.Set("code_challenge", base64.RawURLEncoding.EncodeToString(challenge[:]))
		query.Set("code_challenge_method", challengeMethodS256)
	}
	target.RawQuery = query.Encode()
	started.URL = target.String()
	return started, nil
}

func FetchToken(ctx context.Context, exchange TokenExchange, policy Policy) Token {
	fields, err := grantFields(exchange)
	if err != nil {
		return Token{Error: err.Error()}
	}
	response := Send(ctx, tokenRequest(exchange, fields), policy)
	if response.Error != "" {
		return Token{Error: response.Body}
	}
	token := readToken(response, time.Now())
	if token.RefreshToken == "" {
		token.RefreshToken = exchange.Config.RefreshToken
	}
	if token.IDToken == "" && exchange.Refresh {
		token.IDToken = exchange.Config.IDToken
	}
	return token
}

func field(key, value string) row {
	return row{Key: key, Value: value, Enabled: true}
}

func grantFields(exchange TokenExchange) ([]row, error) {
	config := exchange.Config
	if strings.TrimSpace(config.TokenURL) == "" {
		return nil, fmt.Errorf("enter the token URL of the provider")
	}
	if exchange.Refresh && config.RefreshToken != "" {
		return []row{field("grant_type", grantRefreshToken), field("refresh_token", config.RefreshToken)}, nil
	}
	switch config.Grant {
	case GrantClientCredentials:
		return []row{field("grant_type", GrantClientCredentials)}, nil
	case GrantPassword:
		return []row{field("grant_type", GrantPassword), field("username", config.Username), field("password", config.Password)}, nil
	case GrantAuthorizationCode:
		if exchange.Code == "" {
			return nil, fmt.Errorf("sign in with the provider to get a token")
		}
		fields := []row{field("grant_type", GrantAuthorizationCode), field("code", exchange.Code), field("redirect_uri", exchange.RedirectURI)}
		if exchange.CodeVerifier != "" {
			fields = append(fields, field("code_verifier", exchange.CodeVerifier))
		}
		return fields, nil
	case GrantDeviceCode:
		if exchange.DeviceCode == "" {
			return nil, fmt.Errorf("start the device sign-in to get a token")
		}
		return []row{field("grant_type", deviceGrantType), field("device_code", exchange.DeviceCode)}, nil
	default:
		return nil, fmt.Errorf("unsupported OAuth 2 grant type %q", config.Grant)
	}
}

func tokenRequest(exchange TokenExchange, fields []row) Request {
	config := exchange.Config
	isRefresh := fields[0].Value == grantRefreshToken
	if config.Scope != "" && !isRefresh && config.Grant != GrantAuthorizationCode && config.Grant != GrantDeviceCode {
		fields = append(fields, field("scope", config.Scope))
	}
	if config.Resource != "" {
		fields = append(fields, field("resource", config.Resource))
	}
	return clientRequest(exchange, config.TokenURL, fields)
}

func clientRequest(exchange TokenExchange, address string, fields []row) Request {
	config := exchange.Config
	request := Request{
		Method:    http.MethodPost,
		URL:       address,
		Headers:   encodeRows([]row{field("Accept", contentTypeJSON)}),
		BodyType:  BodyForm,
		Variables: exchange.Variables,
		Options:   exchange.Options,
	}
	if config.CredentialsIn == credentialsInBody || config.ClientSecret == "" {
		fields = append(fields, field("client_id", config.ClientID))
		if config.ClientSecret != "" {
			fields = append(fields, field("client_secret", config.ClientSecret))
		}
	} else {
		request.Auth = Auth{Type: authBasic, Username: config.ClientID, Password: config.ClientSecret}
	}
	request.Body = encodeRows(fields)
	return request
}

func readToken(response Response, now time.Time) Token {
	payload := decodeTokenPayload(response.Body)
	if payload.Error == errorPending || payload.Error == errorSlowDown {
		return Token{Pending: true, SlowDown: payload.Error == errorSlowDown}
	}
	if payload.AccessToken == "" {
		return Token{Error: tokenFailure(response, payload)}
	}
	return Token{
		AccessToken:  payload.AccessToken,
		RefreshToken: payload.RefreshToken,
		IDToken:      payload.IDToken,
		ExpiresAt:    expiryAt(now, payload.ExpiresIn),
	}
}

func expiryAt(now time.Time, expiresIn json.Number) int64 {
	seconds, err := expiresIn.Float64()
	if err != nil || seconds <= 0 {
		return 0
	}
	return now.Add(time.Duration(seconds * float64(time.Second))).UnixMilli()
}

func decodeTokenPayload(body string) tokenPayload {
	var payload tokenPayload
	if json.Unmarshal([]byte(body), &payload) == nil {
		return payload
	}
	form, err := url.ParseQuery(body)
	if err != nil {
		return tokenPayload{}
	}
	return tokenPayload{
		AccessToken:      form.Get("access_token"),
		RefreshToken:     form.Get("refresh_token"),
		IDToken:          form.Get("id_token"),
		ExpiresIn:        json.Number(form.Get("expires_in")),
		Error:            form.Get("error"),
		ErrorDescription: form.Get("error_description"),
	}
}

func tokenFailure(response Response, payload tokenPayload) string {
	switch {
	case payload.ErrorDescription != "":
		return payload.ErrorDescription
	case payload.Error != "":
		return payload.Error
	default:
		return fmt.Sprintf("the token endpoint answered %s without an access token", response.Status)
	}
}

func (c OAuth2) WithoutTokens() OAuth2 {
	c.AccessToken, c.RefreshToken, c.IDToken, c.ExpiresAt, c.TokenEnvironment = "", "", "", 0, ""
	return c
}

func sentToken(config OAuth2) string {
	if config.SendIDToken {
		return config.IDToken
	}
	return config.AccessToken
}

func oauthHeader(config OAuth2) (string, bool) {
	token := sentToken(config)
	if token == "" {
		return "", false
	}
	prefix := strings.TrimSpace(config.HeaderPrefix)
	if prefix == "" {
		prefix = defaultTokenPrefix
	}
	return prefix + " " + token, true
}
