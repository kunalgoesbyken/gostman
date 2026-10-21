package secrets

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

const (
	azureAPIVersion = "7.4"
	azureScope      = "https://vault.azure.net/.default"
	azureAuthority  = "https://login.microsoftonline.com"
	azureSecrets    = "secrets"
)

type azure struct {
	gateway      *gateway
	address      *url.URL
	authority    *url.URL
	token        string
	tenantID     string
	clientID     string
	clientSecret string
}

func newAzure(connection Connection, gateway *gateway) (Provider, error) {
	address, err := parseAddress(connection.value(fieldAddress), fieldAddress)
	if err != nil {
		return nil, err
	}
	authority := connection.value(fieldAuthority)
	if authority == "" {
		authority = azureAuthority
	}
	authorityAddress, err := parseAddress(authority, fieldAuthority)
	if err != nil {
		return nil, err
	}
	provider := &azure{
		gateway:      gateway,
		address:      address,
		authority:    authorityAddress,
		token:        connection.value(fieldToken),
		tenantID:     connection.value(fieldTenantID),
		clientID:     connection.value(fieldClientID),
		clientSecret: connection.value(fieldClientSecret),
	}
	if provider.token == "" && (provider.tenantID == "" || provider.clientID == "" || provider.clientSecret == "") {
		return nil, errors.New("needs a token, or a tenant ID, a client ID and a client secret")
	}
	return provider, nil
}

func (a *azure) credential(ctx context.Context) (string, error) {
	if a.token != "" {
		return a.token, nil
	}
	form := url.Values{
		"grant_type":    {"client_credentials"},
		"client_id":     {a.clientID},
		"client_secret": {a.clientSecret},
		"scope":         {azureScope},
	}
	target := endpoint(a.authority, a.tenantID, "oauth2", "v2.0", "token")
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, target.String(), strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	answer, err := a.gateway.exchange(ctx, request)
	if err != nil {
		return "", err
	}
	if err := answer.problem(); err != nil {
		return "", fmt.Errorf("signing in with the client credentials failed: %w", err)
	}
	var granted struct {
		AccessToken string `json:"access_token"`
	}
	if json.Unmarshal(answer.body, &granted) != nil || granted.AccessToken == "" {
		return "", errors.New("signing in with the client credentials returned no token")
	}
	return granted.AccessToken, nil
}

func (a *azure) Resolve(ctx context.Context, ref Ref) (string, error) {
	token, err := a.credential(ctx)
	if err != nil {
		return "", err
	}
	segments := []string{azureSecrets, ref.Path}
	if ref.Version != "" {
		segments = append(segments, ref.Version)
	}
	target := endpoint(a.address, segments...)
	target.RawQuery = url.Values{"api-version": {azureAPIVersion}}.Encode()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return "", err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	answer, err := a.gateway.exchange(ctx, request)
	if err != nil {
		return "", err
	}
	if err := answer.problem(); err != nil {
		return "", err
	}
	var payload struct {
		Value string `json:"value"`
	}
	if json.Unmarshal(answer.body, &payload) != nil {
		return "", errors.New("the answer could not be read")
	}
	return payload.Value, nil
}
