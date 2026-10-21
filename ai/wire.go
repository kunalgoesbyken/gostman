package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

const maxReplyBytes = 1 << 20

type apiError struct {
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}

func post(ctx context.Context, client *http.Client, endpoint string, headers map[string]string, body any, reply any) error {
	encoded, err := json.Marshal(body)
	if err != nil {
		return failure(KindConfig, "Could not build the request")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(encoded))
	if err != nil {
		return failure(KindConfig, "The base URL is not usable")
	}
	request.Header.Set("Content-Type", "application/json")
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	response, err := client.Do(request)
	if err != nil {
		return transportError(ctx, err)
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, maxReplyBytes))
	if err != nil {
		return transportError(ctx, err)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return statusError(response.StatusCode, providerMessage(raw))
	}
	if err := json.Unmarshal(raw, reply); err != nil {
		return failure(KindReply, "The provider answered with something that is not JSON. Check the base URL")
	}
	return nil
}

func providerMessage(raw []byte) string {
	var parsed apiError
	if json.Unmarshal(raw, &parsed) == nil && parsed.Error.Message != "" {
		return cleanDetail(parsed.Error.Message)
	}
	return ""
}

func joinURL(base string, parts ...string) string {
	return strings.TrimRight(base, "/") + "/" + strings.Join(parts, "/")
}
