package secrets

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
)

const (
	gcpAddress       = "https://secretmanager.googleapis.com"
	gcpLatestVersion = "latest"
	gcpAccessVerb    = ":access"
)

type google struct {
	gateway *gateway
	address *url.URL
	token   string
	project string
}

func newGCP(connection Connection, gateway *gateway) (Provider, error) {
	raw := connection.value(fieldAddress)
	if raw == "" {
		raw = gcpAddress
	}
	address, err := parseAddress(raw, fieldAddress)
	if err != nil {
		return nil, err
	}
	token := connection.value(fieldToken)
	if token == "" {
		return nil, errors.New("needs a token")
	}
	return &google{gateway: gateway, address: address, token: token, project: connection.value(fieldProject)}, nil
}

func (g *google) resource(ref Ref) ([]string, error) {
	segments := ref.segments()
	if len(segments) > 1 {
		return segments, nil
	}
	if g.project == "" {
		return nil, errors.New("give the full resource name, or set a project on the connection")
	}
	return []string{"projects", g.project, "secrets", ref.Path}, nil
}

func (g *google) Resolve(ctx context.Context, ref Ref) (string, error) {
	resource, err := g.resource(ref)
	if err != nil {
		return "", err
	}
	version := ref.Version
	if version == "" {
		version = gcpLatestVersion
	}
	segments := append([]string{"v1"}, resource...)
	segments = append(segments, "versions", version+gcpAccessVerb)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint(g.address, segments...).String(), nil)
	if err != nil {
		return "", err
	}
	request.Header.Set("Authorization", "Bearer "+g.token)
	answer, err := g.gateway.exchange(ctx, request)
	if err != nil {
		return "", err
	}
	if err := answer.problem(); err != nil {
		return "", err
	}
	var payload struct {
		Payload struct {
			Data string `json:"data"`
		} `json:"payload"`
	}
	if json.Unmarshal(answer.body, &payload) != nil {
		return "", errors.New("the answer could not be read")
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(payload.Payload.Data))
	if err != nil {
		return "", errors.New("the secret payload is not valid base64")
	}
	return string(decoded), nil
}
