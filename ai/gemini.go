package ai

import (
	"context"
	"net/http"
	"net/url"
	"strings"
)

type geminiWire struct {
	client *http.Client
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiReply struct {
	Candidates []struct {
		Content geminiContent `json:"content"`
	} `json:"candidates"`
}

func (w geminiWire) Complete(ctx context.Context, call Call) (string, error) {
	body := map[string]any{
		"systemInstruction": geminiContent{Parts: []geminiPart{{Text: call.Prompt.System}}},
		"contents":          []geminiContent{{Role: "user", Parts: []geminiPart{{Text: call.Prompt.User}}}},
		"generationConfig":  map[string]any{"maxOutputTokens": call.MaxTokens},
	}
	headers := map[string]string{"x-goog-api-key": call.Key}
	endpoint := joinURL(call.BaseURL, "v1beta", "models", url.PathEscape(call.Model)+":generateContent")
	var reply geminiReply
	if err := post(ctx, w.client, endpoint, headers, body, &reply); err != nil {
		return "", err
	}
	if len(reply.Candidates) == 0 {
		return "", failure(KindReply, "The provider returned no answer")
	}
	var text strings.Builder
	for _, part := range reply.Candidates[0].Content.Parts {
		text.WriteString(part.Text)
	}
	if text.Len() == 0 {
		return "", failure(KindReply, "The provider returned no answer")
	}
	return strings.TrimSpace(text.String()), nil
}
