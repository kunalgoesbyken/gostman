package secrets

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

const (
	vaultTokenHeader     = "X-Vault-Token"
	vaultNamespaceHeader = "X-Vault-Namespace"
	vaultDefaultMount    = "secret"
	vaultKVVersion1      = "1"
	vaultKVVersion2      = "2"
	vaultAPIPrefix       = "v1"
	vaultDataSegment     = "data"
	vaultLoginSegments   = "auth/approle/login"
)

type vault struct {
	gateway   *gateway
	address   *url.URL
	namespace string
	mount     []string
	isKV2     bool
	token     string
	roleID    string
	secretID  string
}

func newVault(connection Connection, gateway *gateway) (Provider, error) {
	address, err := parseAddress(connection.value(fieldAddress), fieldAddress)
	if err != nil {
		return nil, err
	}
	provider := &vault{
		gateway:   gateway,
		address:   address,
		namespace: connection.value(fieldNamespace),
		mount:     splitPath(connection.value(fieldMount), vaultDefaultMount),
		token:     connection.value(fieldToken),
		roleID:    connection.value(fieldRoleID),
		secretID:  connection.value(fieldSecretID),
	}
	switch version := connection.value(fieldKVVersion); version {
	case "", vaultKVVersion2:
		provider.isKV2 = true
	case vaultKVVersion1:
	default:
		return nil, fmt.Errorf("the KV version %q must be %s or %s", version, vaultKVVersion1, vaultKVVersion2)
	}
	if provider.token == "" && (provider.roleID == "" || provider.secretID == "") {
		return nil, errors.New("needs a token, or a role ID with a secret ID")
	}
	return provider, nil
}

func splitPath(path, fallback string) []string {
	var segments []string
	for _, segment := range strings.Split(path, "/") {
		if segment != "" {
			segments = append(segments, segment)
		}
	}
	if len(segments) == 0 {
		return []string{fallback}
	}
	return segments
}

func (v *vault) request(ctx context.Context, method string, target *url.URL, body []byte) (*http.Request, error) {
	request, err := http.NewRequestWithContext(ctx, method, target.String(), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	if v.namespace != "" {
		request.Header.Set(vaultNamespaceHeader, v.namespace)
	}
	return request, nil
}

func (v *vault) login(ctx context.Context) (string, error) {
	body, err := json.Marshal(map[string]string{"role_id": v.roleID, "secret_id": v.secretID})
	if err != nil {
		return "", err
	}
	request, err := v.request(ctx, http.MethodPost, endpoint(v.address, vaultAPIPrefix, vaultLoginSegments), body)
	if err != nil {
		return "", err
	}
	answer, err := v.gateway.exchange(ctx, request)
	if err != nil {
		return "", err
	}
	if err := answer.problem(); err != nil {
		return "", fmt.Errorf("signing in with the role failed: %w", err)
	}
	var login struct {
		Auth struct {
			ClientToken string `json:"client_token"`
		} `json:"auth"`
	}
	if json.Unmarshal(answer.body, &login) != nil || login.Auth.ClientToken == "" {
		return "", errors.New("signing in with the role returned no token")
	}
	return login.Auth.ClientToken, nil
}

func (v *vault) credential(ctx context.Context) (string, error) {
	if v.token != "" {
		return v.token, nil
	}
	return v.login(ctx)
}

func (v *vault) target(ref Ref) *url.URL {
	segments := append([]string{vaultAPIPrefix}, v.mount...)
	if v.isKV2 {
		segments = append(segments, vaultDataSegment)
	}
	target := endpoint(v.address, append(segments, ref.segments()...)...)
	if v.isKV2 && ref.Version != "" {
		target.RawQuery = url.Values{"version": {ref.Version}}.Encode()
	}
	return target
}

func (v *vault) Resolve(ctx context.Context, ref Ref) (string, error) {
	if ref.Field == "" {
		return "", errors.New("name the field to read from the secret")
	}
	token, err := v.credential(ctx)
	if err != nil {
		return "", err
	}
	request, err := v.request(ctx, http.MethodGet, v.target(ref), nil)
	if err != nil {
		return "", err
	}
	request.Header.Set(vaultTokenHeader, token)
	answer, err := v.gateway.exchange(ctx, request)
	if err != nil {
		return "", err
	}
	if err := answer.problem(); err != nil {
		return "", err
	}
	return v.data(answer.body)
}

func (v *vault) data(body []byte) (string, error) {
	var envelope struct {
		Data json.RawMessage `json:"data"`
	}
	if json.Unmarshal(body, &envelope) != nil || len(envelope.Data) == 0 {
		return "", errors.New("the answer holds no secret data")
	}
	if !v.isKV2 {
		return string(envelope.Data), nil
	}
	var versioned struct {
		Data json.RawMessage `json:"data"`
	}
	if json.Unmarshal(envelope.Data, &versioned) != nil || len(versioned.Data) == 0 || string(versioned.Data) == "null" {
		return "", errors.New("the answer holds no secret data; the version may be deleted, or the mount is a KV version 1 engine")
	}
	return string(versioned.Data), nil
}
