package ai

import (
	"context"
	"net/http"
	"net/url"
	"slices"
	"strings"
)

const (
	geminiModels     = "models?pageSize=1000"
	geminiModelName  = "models/"
	geminiGenerate   = "generateContent"
	geminiCutOff     = "MAX_TOKENS"
	jsonResponseType = "application/json"
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
		Content      geminiContent `json:"content"`
		FinishReason string        `json:"finishReason"`
	} `json:"candidates"`
}

type geminiModelList struct {
	Models []struct {
		Name    string   `json:"name"`
		Methods []string `json:"supportedGenerationMethods"`
	} `json:"models"`
}

func geminiHeaders(key string) map[string]string { return map[string]string{"x-goog-api-key": key} }

func (w geminiWire) Complete(ctx context.Context, call Call) (Answer, error) {
	generation := map[string]any{"maxOutputTokens": call.MaxTokens}
	if call.Prompt.Schema != nil {
		generation["responseMimeType"] = jsonResponseType
		generation["responseJsonSchema"] = call.Prompt.Schema
	}
	body := map[string]any{
		"systemInstruction": geminiContent{Parts: []geminiPart{{Text: call.Prompt.System}}},
		"contents":          []geminiContent{{Role: "user", Parts: []geminiPart{{Text: call.Prompt.User}}}},
		"generationConfig":  generation,
	}
	endpoint := joinURL(call.BaseURL, "v1beta", "models", url.PathEscape(call.Model)+":"+geminiGenerate)
	var reply geminiReply
	if err := post(ctx, w.client, endpoint, geminiHeaders(call.Key), body, &reply); err != nil {
		return Answer{}, err
	}
	if len(reply.Candidates) == 0 {
		return Answer{}, nil
	}
	candidate := reply.Candidates[0]
	var text strings.Builder
	for _, part := range candidate.Content.Parts {
		text.WriteString(part.Text)
	}
	return Answer{Text: text.String(), CutOff: candidate.FinishReason == geminiCutOff}, nil
}

func (w geminiWire) Models(ctx context.Context, call Call) ([]string, error) {
	var reply geminiModelList
	if err := get(ctx, w.client, joinURL(call.BaseURL, "v1beta", geminiModels), geminiHeaders(call.Key), &reply); err != nil {
		return nil, err
	}
	var ids []string
	for _, model := range reply.Models {
		if slices.Contains(model.Methods, geminiGenerate) {
			ids = append(ids, strings.TrimPrefix(model.Name, geminiModelName))
		}
	}
	return ids, nil
}
