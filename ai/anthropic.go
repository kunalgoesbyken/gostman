package ai

import (
	"context"
	"net/http"
	"strings"
)

const (
	anthropicVersion = "2023-06-01"
	anthropicModels  = "models?limit=1000"
)

var anthropicCutOff = map[string]bool{"max_tokens": true, "model_context_window_exceeded": true}

type anthropicWire struct {
	client *http.Client
}

type anthropicReply struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	StopReason string `json:"stop_reason"`
}

type modelList struct {
	Data []struct {
		ID string `json:"id"`
	} `json:"data"`
}

func (list modelList) ids() []string {
	ids := make([]string, 0, len(list.Data))
	for _, model := range list.Data {
		ids = append(ids, model.ID)
	}
	return ids
}

func anthropicHeaders(key string) map[string]string {
	return map[string]string{"x-api-key": key, "anthropic-version": anthropicVersion}
}

func (w anthropicWire) Complete(ctx context.Context, call Call) (Answer, error) {
	body := map[string]any{
		"model":      call.Model,
		"max_tokens": call.MaxTokens,
		"system":     call.Prompt.System,
		"messages":   []chatMessage{{Role: "user", Content: call.Prompt.User}},
	}
	if call.Prompt.Schema != nil {
		body["output_config"] = map[string]any{"format": map[string]any{"type": "json_schema", "schema": call.Prompt.Schema}}
	}
	var reply anthropicReply
	if err := post(ctx, w.client, joinURL(call.BaseURL, "v1", "messages"), anthropicHeaders(call.Key), body, &reply); err != nil {
		return Answer{}, err
	}
	var text strings.Builder
	for _, block := range reply.Content {
		if block.Type == "text" {
			text.WriteString(block.Text)
		}
	}
	return Answer{Text: text.String(), CutOff: anthropicCutOff[reply.StopReason]}, nil
}

func (w anthropicWire) Models(ctx context.Context, call Call) ([]string, error) {
	var reply modelList
	if err := get(ctx, w.client, joinURL(call.BaseURL, "v1", anthropicModels), anthropicHeaders(call.Key), &reply); err != nil {
		return nil, err
	}
	return reply.ids(), nil
}
