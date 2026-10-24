package ai

import (
	"context"
	"net/http"
)

const (
	finishLength = "length"
	schemaName   = "reply"
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
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
}

func bearer(key string) map[string]string {
	if key == "" {
		return map[string]string{}
	}
	return map[string]string{"Authorization": "Bearer " + key}
}

func (w openAIWire) Complete(ctx context.Context, call Call) (Answer, error) {
	body := map[string]any{
		"model":      call.Model,
		w.tokenField: call.MaxTokens,
		"messages": []chatMessage{
			{Role: "system", Content: call.Prompt.System},
			{Role: "user", Content: call.Prompt.User},
		},
	}
	if call.Prompt.Schema != nil {
		body["response_format"] = map[string]any{
			"type":        "json_schema",
			"json_schema": map[string]any{"name": schemaName, "strict": true, "schema": call.Prompt.Schema},
		}
	}
	var reply chatReply
	if err := post(ctx, w.client, joinURL(call.BaseURL, "chat", "completions"), bearer(call.Key), body, &reply); err != nil {
		return Answer{}, err
	}
	if len(reply.Choices) == 0 {
		return Answer{}, nil
	}
	choice := reply.Choices[0]
	return Answer{Text: choice.Message.Content, CutOff: choice.FinishReason == finishLength}, nil
}

func (w openAIWire) Models(ctx context.Context, call Call) ([]string, error) {
	var reply modelList
	if err := get(ctx, w.client, joinURL(call.BaseURL, "models"), bearer(call.Key), &reply); err != nil {
		return nil, err
	}
	return reply.ids(), nil
}
