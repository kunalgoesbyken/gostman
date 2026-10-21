package ai

import (
	"context"
	"net/http"
	"strings"
)

type openAIWire struct {
	client     *http.Client
	tokenField string
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatReply struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (w openAIWire) Complete(ctx context.Context, call Call) (string, error) {
	body := map[string]any{
		"model":      call.Model,
		w.tokenField: call.MaxTokens,
		"messages": []chatMessage{
			{Role: "system", Content: call.Prompt.System},
			{Role: "user", Content: call.Prompt.User},
		},
	}
	headers := map[string]string{}
	if call.Key != "" {
		headers["Authorization"] = "Bearer " + call.Key
	}
	var reply chatReply
	if err := post(ctx, w.client, joinURL(call.BaseURL, "chat", "completions"), headers, body, &reply); err != nil {
		return "", err
	}
	if len(reply.Choices) == 0 {
		return "", failure(KindReply, "The provider returned no answer")
	}
	return strings.TrimSpace(reply.Choices[0].Message.Content), nil
}
