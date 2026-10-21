package ai

import (
	"context"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/krockxz/gostman/redact"
)

const (
	MaxPromptBytes  = 96 * 1024
	MaxOutputBytes  = 64 * 1024
	DefaultTokens   = 2048
	MaxTokens       = 4096
	CheckTokens     = 32
	RequestTimeout  = 90 * time.Second
	checkPrompt     = "Reply with the single word ok."
	checkSystem     = "You are a connection test."
	localhostName   = "localhost"
	secretLabel     = "secret"
	insecureWarning = "Use https for this base URL, or allow plain http for it in the AI settings"
)

func newClient() *http.Client {
	return &http.Client{
		Timeout: RequestTimeout,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

func isLoopbackHost(host string) bool {
	if strings.EqualFold(host, localhostName) {
		return true
	}
	address := net.ParseIP(host)
	return address != nil && address.IsLoopback()
}

func resolveBase(config Config, preset Preset) (string, *Error) {
	base := strings.TrimSpace(config.BaseURL)
	if base == "" {
		base = preset.BaseURL
	}
	parsed, err := url.Parse(base)
	if err != nil || parsed.Host == "" || parsed.User != nil {
		return "", failure(KindConfig, "The base URL is not a valid address")
	}
	if parsed.Scheme == "https" || (parsed.Scheme == "http" && (isLoopbackHost(parsed.Hostname()) || config.AllowInsecure)) {
		return strings.TrimRight(parsed.String(), "/"), nil
	}
	if parsed.Scheme == "http" {
		return "", failure(KindConfig, insecureWarning)
	}
	return "", failure(KindConfig, "The base URL must start with https://")
}

func resolve(config Config, key string) (Provider, string, *Error) {
	preset, known := presets()[config.Provider]
	if !known {
		return nil, "", failure(KindConfig, "Choose a provider")
	}
	if strings.TrimSpace(config.Model) == "" {
		return nil, "", failure(KindConfig, "Enter a model id")
	}
	if preset.KeyRequired && key == "" {
		return nil, "", failure(KindConfig, "Paste an API key for this provider")
	}
	base, problem := resolveBase(config, preset)
	if problem != nil {
		return nil, "", problem
	}
	return preset.Provider(newClient()), base, nil
}

func Scrub(prompt Prompt, secrets []string) Prompt {
	scrubber := redact.New()
	for _, secret := range secrets {
		scrubber.LearnSecret(secretLabel, secret)
	}
	return Prompt{System: scrubber.Text(prompt.System), User: scrubber.Text(prompt.User)}
}

func withinLimit(prompt Prompt) *Error {
	if len(prompt.System)+len(prompt.User) > MaxPromptBytes {
		return failure(KindTooLarge, "The request is too large to send. Select less content")
	}
	return nil
}

func capTokens(requested int) int {
	if requested <= 0 {
		return DefaultTokens
	}
	return min(requested, MaxTokens)
}

func capOutput(text string) string {
	if len(text) <= MaxOutputBytes {
		return text
	}
	return text[:MaxOutputBytes]
}

func complete(ctx context.Context, config Config, key string, prompt Prompt, tokens int) (string, error) {
	provider, base, problem := resolve(config, key)
	if problem != nil {
		return "", problem
	}
	if problem := withinLimit(prompt); problem != nil {
		return "", problem
	}
	ctx, cancel := context.WithTimeout(ctx, RequestTimeout)
	defer cancel()
	call := Call{BaseURL: base, Model: strings.TrimSpace(config.Model), Key: key, Prompt: prompt, MaxTokens: tokens}
	text, err := provider.Complete(ctx, call)
	if err != nil {
		return "", masked(err, key)
	}
	return capOutput(text), nil
}

func Run(ctx context.Context, config Config, key string, prompt Prompt, secrets []string, maxTokens int) (string, error) {
	return complete(ctx, config, key, Scrub(prompt, append(secrets, key)), capTokens(maxTokens))
}

func Check(ctx context.Context, config Config, key string) error {
	_, err := complete(ctx, config, key, Prompt{System: checkSystem, User: checkPrompt}, CheckTokens)
	return err
}
