package importer

import (
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	authBasic    = "basic"
	authBearer   = "bearer"
	authAPIKey   = "apikey"
	authDigest   = "digest"
	authNTLM     = "ntlm"
	authAWS      = "awsv4"
	authOAuth1   = "oauth1"
	authOAuth2   = "oauth2"
	authEdgeGrid = "edgegrid"
	authJWT      = "jwt"
	authASAP     = "asap"
	authHawk     = "hawk"
	inHeader     = "header"
	inQuery      = "query"

	jwtSecretBase64 = "base64"
	hawkIncludeHash = "include"

	grantClientCredentials = "client_credentials"
	grantPassword          = "password"
	grantAuthorizationCode = "authorization_code"
	credentialsInBody      = "body"
	basicAuthHeader        = "basic_auth_header"
	idTokenSource          = "id_token"
)

type oauth2Fields struct {
	Grant        string
	AuthURL      string
	TokenURL     string
	ClientID     string
	ClientSecret string
	Scope        string
	Username     string
	Password     string
	CallbackURL  string
	HeaderPrefix string
	Resource     string
	PKCE         bool
	SecretInBody bool
	SendIDToken  bool
}

func credentialsAuth(kind, username, password string) engine.Auth {
	return engine.Auth{Type: kind, Username: username, Password: password}
}

func bearerAuth(token string) engine.Auth {
	return engine.Auth{Type: authBearer, Token: token}
}

func apiKeyAuth(key, value string, inQueryString bool) engine.Auth {
	placement := inHeader
	if inQueryString {
		placement = inQuery
	}
	return engine.Auth{Type: authAPIKey, Key: key, Value: value, In: placement}
}

func ntlmAuth(username, password, domain string) engine.Auth {
	auth := credentialsAuth(authNTLM, username, password)
	auth.Domain = domain
	return auth
}

func awsAuth(accessKey, secretKey, sessionToken, region, service string) engine.Auth {
	return engine.Auth{Type: authAWS, AWS: engine.AWSAuth{
		AccessKey: accessKey, SecretKey: secretKey, SessionToken: sessionToken, Region: region, Service: service,
	}}
}

func asapAuth(config engine.ASAPAuth) engine.Auth {
	return engine.Auth{Type: authASAP, ASAP: config}
}

func hawkAuth(config engine.HawkAuth, includeHash bool) engine.Auth {
	if includeHash {
		config.PayloadHash = hawkIncludeHash
	}
	return engine.Auth{Type: authHawk, Hawk: config}
}

func oauth2Auth(fields oauth2Fields) (engine.Auth, bool) {
	grant := strings.ToLower(strings.TrimSpace(fields.Grant))
	switch grant {
	case grantClientCredentials, grantPassword, grantAuthorizationCode:
	default:
		return engine.Auth{}, false
	}
	auth := engine.Auth{Type: authOAuth2, OAuth2: engine.OAuth2{
		Grant:        grant,
		AuthURL:      fields.AuthURL,
		TokenURL:     fields.TokenURL,
		ClientID:     fields.ClientID,
		ClientSecret: fields.ClientSecret,
		Scope:        fields.Scope,
		Username:     fields.Username,
		Password:     fields.Password,
		CallbackURL:  fields.CallbackURL,
		HeaderPrefix: fields.HeaderPrefix,
		Resource:     fields.Resource,
		PKCE:         fields.PKCE,
		SendIDToken:  fields.SendIDToken,
	}}
	if fields.SecretInBody {
		auth.OAuth2.CredentialsIn = credentialsInBody
	}
	return auth, true
}

func (c *collector) checkedAuth(name string, auth engine.Auth, supported bool) *engine.Auth {
	if !supported {
		c.flag(messageAuthDropped, name)
	}
	return &auth
}
