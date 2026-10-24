package ai

import (
	"context"
	"net/http"
)

const (
	Anthropic  = "anthropic"
	OpenAI     = "openai"
	Gemini     = "gemini"
	OpenRouter = "openrouter"
	Ollama     = "ollama"
	LMStudio   = "lmstudio"
	Custom     = "custom"
)

type Config struct {
	Provider      string `json:"provider"`
	BaseURL       string `json:"baseUrl"`
	Model         string `json:"model"`
	AllowInsecure bool   `json:"allowInsecure"`
}

type Prompt struct {
	System string `json:"system"`
	User   string `json:"user"`
	Schema any    `json:"schema,omitempty"`
}

type Call struct {
	BaseURL   string
	Model     string
	Key       string
	Prompt    Prompt
	MaxTokens int
}

type Answer struct {
	Text   string
	CutOff bool
}

type Provider interface {
	Complete(ctx context.Context, call Call) (Answer, error)
	Models(ctx context.Context, call Call) ([]string, error)
}

type Preset struct {
	BaseURL     string
	KeyRequired bool
	Provider    func(client *http.Client) Provider
}

func chatWire(tokenField string) func(*http.Client) Provider {
	return func(client *http.Client) Provider { return openAIWire{client: client, tokenField: tokenField} }
}

func presets() map[string]Preset {
	return map[string]Preset{
		Anthropic: {BaseURL: "https://api.anthropic.com", KeyRequired: true, Provider: func(client *http.Client) Provider {
			return anthropicWire{client}
		}},
		OpenAI:     {BaseURL: "https://api.openai.com/v1", KeyRequired: true, Provider: chatWire("max_completion_tokens")},
		Gemini:     {BaseURL: "https://generativelanguage.googleapis.com", KeyRequired: true, Provider: func(client *http.Client) Provider { return geminiWire{client} }},
		OpenRouter: {BaseURL: "https://openrouter.ai/api/v1", KeyRequired: true, Provider: chatWire("max_tokens")},
		Ollama:     {BaseURL: "http://localhost:11434/v1", Provider: chatWire("max_tokens")},
		LMStudio:   {BaseURL: "http://localhost:1234/v1", Provider: chatWire("max_tokens")},
		Custom:     {Provider: chatWire("max_tokens")},
	}
}
