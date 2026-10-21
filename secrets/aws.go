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

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	awsService      = "secretsmanager"
	awsTarget       = "secretsmanager.GetSecretValue"
	awsContentType  = "application/x-amz-json-1.1"
	awsHostTemplate = "https://secretsmanager.%s.amazonaws.com"
)

var awsFailures = map[string]string{
	"ResourceNotFoundException":   "not found",
	"AccessDeniedException":       "access denied; check the permissions of the credentials",
	"UnrecognizedClientException": "the credentials are not recognised",
	"InvalidSignatureException":   "the credentials were rejected",
	"ExpiredTokenException":       "the session token has expired",
	"DecryptionFailure":           "the secret could not be decrypted with its key",
}

type amazon struct {
	gateway *gateway
	address *url.URL
	auth    engine.AWSAuth
}

func newAWS(connection Connection, gateway *gateway) (Provider, error) {
	region := connection.value(fieldRegion)
	raw := connection.value(fieldAddress)
	if raw == "" {
		raw = fmt.Sprintf(awsHostTemplate, region)
	}
	address, err := parseAddress(raw, fieldAddress)
	if err != nil {
		return nil, err
	}
	auth := engine.AWSAuth{
		AccessKey:    connection.value(fieldAccessKey),
		SecretKey:    connection.value(fieldSecretKey),
		SessionToken: connection.value(fieldSessionToken),
		Region:       region,
		Service:      awsService,
	}
	if auth.AccessKey == "" || auth.SecretKey == "" || region == "" {
		return nil, errors.New("needs a region, an access key and a secret key")
	}
	return &amazon{gateway: gateway, address: address, auth: auth}, nil
}

func (a *amazon) Resolve(ctx context.Context, ref Ref) (string, error) {
	query := map[string]string{"SecretId": ref.Path}
	if ref.Version != "" {
		query["VersionStage"] = ref.Version
	}
	body, err := json.Marshal(query)
	if err != nil {
		return "", err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint(a.address).String(), bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", awsContentType)
	request.Header.Set("X-Amz-Target", awsTarget)
	engine.SignAWS(a.auth, request, body)
	answer, err := a.gateway.exchange(ctx, request)
	if err != nil {
		return "", err
	}
	if err := a.problem(answer); err != nil {
		return "", err
	}
	var payload struct {
		SecretString string `json:"SecretString"`
		SecretBinary string `json:"SecretBinary"`
	}
	if json.Unmarshal(answer.body, &payload) != nil {
		return "", errors.New("the answer could not be read")
	}
	if payload.SecretString == "" && payload.SecretBinary != "" {
		return "", errors.New("binary secrets are not supported; store the value as text")
	}
	return payload.SecretString, nil
}

func (a *amazon) problem(answer reply) error {
	if answer.status >= 200 && answer.status < 300 {
		return nil
	}
	var failure struct {
		Type string `json:"__type"`
	}
	_ = json.Unmarshal(answer.body, &failure)
	name := failure.Type[strings.LastIndex(failure.Type, "#")+1:]
	if message, known := awsFailures[name]; known {
		return fmt.Errorf("%s (HTTP %d)", message, answer.status)
	}
	return answer.problem()
}
