package ai

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/redact"
)

const (
	MaxPromptBytes  = 96 * 1024
	MaxOutputBytes  = 64 * 1024
	DefaultTokens   = 4096
	MaxTokens       = 8192
	CheckTokens     = 32
	MaxModels       = 1000
	RequestTimeout  = 120 * time.Second
	checkPrompt     = "Reply with the single word ok."
	checkSystem     = "You are a connection test."
	localhostName   = "localhost"
	secretLabel     = "secret"
	noAnswer        = "The provider returned no answer"
	cutOff          = "The answer was cut off because it reached the length limit"
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

func ResolveBase(config Config) (string, *Error) {
	preset, known := presets()[config.Provider]
	if !known {
		return "", failure(KindConfig, "Choose a provider")
	}
	return resolveBase(config, preset)
}

func connect(config Config, key string) (Provider, string, *Error) {
	preset, known := presets()[config.Provider]
	if !known {
		return nil, "", failure(KindConfig, "Choose a provider")
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
	return Prompt{System: scrubber.Text(prompt.System), User: scrubber.Text(prompt.User), Schema: prompt.Schema}
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

func rejectsSchema(err error) bool {
	var failed *Error
	return errors.As(err, &failed) && failed.Kind == KindRequest &&
		(failed.Status == http.StatusBadRequest || failed.Status == http.StatusUnprocessableEntity)
}

func ask(ctx context.Context, provider Provider, call Call) (Answer, error) {
	answer, err := provider.Complete(ctx, call)
	if err != nil && call.Prompt.Schema != nil && rejectsSchema(err) {
		call.Prompt.Schema = nil
		return provider.Complete(ctx, call)
	}
	return answer, err
}

func complete(ctx context.Context, config Config, key string, prompt Prompt, tokens int) (Answer, error) {
	if strings.TrimSpace(config.Model) == "" {
		return Answer{}, failure(KindConfig, "Enter a model id")
	}
	provider, base, problem := connect(config, key)
	if problem != nil {
		return Answer{}, problem
	}
	if problem := withinLimit(prompt); problem != nil {
		return Answer{}, problem
	}
	ctx, cancel := context.WithTimeout(ctx, RequestTimeout)
	defer cancel()
	call := Call{BaseURL: base, Model: strings.TrimSpace(config.Model), Key: key, Prompt: prompt, MaxTokens: tokens}
	answer, err := ask(ctx, provider, call)
	if err != nil {
		return Answer{}, masked(err, key)
	}
	return answer, nil
}

func Run(ctx context.Context, config Config, key string, prompt Prompt, secrets []string, maxTokens int) (string, error) {
	answer, err := complete(ctx, config, key, Scrub(prompt, append(secrets, key)), capTokens(maxTokens))
	switch {
	case err != nil:
		return "", err
	case answer.CutOff:
		return "", failure(KindCutOff, cutOff)
	case strings.TrimSpace(answer.Text) == "":
		return "", failure(KindReply, noAnswer)
	}
	return capOutput(strings.TrimSpace(answer.Text)), nil
}

func Check(ctx context.Context, config Config, key string) error {
	answer, err := complete(ctx, config, key, Prompt{System: checkSystem, User: checkPrompt}, CheckTokens)
	if err == nil && !answer.CutOff && strings.TrimSpace(answer.Text) == "" {
		return failure(KindReply, noAnswer)
	}
	return err
}

func Models(ctx context.Context, config Config, key string) ([]string, error) {
	provider, base, problem := connect(config, key)
	if problem != nil {
		return nil, problem
	}
	ctx, cancel := context.WithTimeout(ctx, RequestTimeout)
	defer cancel()
	ids, err := provider.Models(ctx, Call{BaseURL: base, Key: key})
	if err != nil {
		return nil, masked(err, key)
	}
	slices.Sort(ids)
	ids = slices.Compact(ids)
	return ids[:min(len(ids), MaxModels)], nil
}
