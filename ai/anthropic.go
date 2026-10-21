package ai

import (
	"context"
	"net/http"
	"strings"
)

const anthropicVersion = "2023-06-01"

type anthropicWire struct {
	client *http.Client
}

type anthropicReply struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

func (w anthropicWire) Complete(ctx context.Context, call Call) (string, error) {
	body := map[string]any{
		"model":      call.Model,
		"max_tokens": call.MaxTokens,
		"system":     call.Prompt.System,
		"messages":   []chatMessage{{Role: "user", Content: call.Prompt.User}},
	}
	headers := map[string]string{"x-api-key": call.Key, "anthropic-version": anthropicVersion}
	var reply anthropicReply
	if err := post(ctx, w.client, joinURL(call.BaseURL, "v1", "messages"), headers, body, &reply); err != nil {
		return "", err
	}
	var text strings.Builder
	for _, block := range reply.Content {
		if block.Type == "text" {
			text.WriteString(block.Text)
		}
	}
	if text.Len() == 0 {
		return "", failure(KindReply, "The provider returned no answer")
	}
	return strings.TrimSpace(text.String()), nil
}
