package ai

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/kunalgoesbyken/gostman/redact"
)

type Kind string

const (
	KindAuth      Kind = "auth"
	KindRateLimit Kind = "rate_limit"
	KindRequest   Kind = "request"
	KindServer    Kind = "server"
	KindNetwork   Kind = "network"
	KindTimeout   Kind = "timeout"
	KindCanceled  Kind = "canceled"
	KindConfig    Kind = "config"
	KindTooLarge  Kind = "too_large"
	KindReply     Kind = "reply"
)

const detailLimit = 300

type Error struct {
	Kind    Kind   `json:"kind"`
	Status  int    `json:"status"`
	Message string `json:"message"`
}

func (e *Error) Error() string { return e.Message }

func failure(kind Kind, format string, args ...any) *Error {
	return &Error{Kind: kind, Message: fmt.Sprintf(format, args...)}
}

func KindOf(err error) Kind {
	var failed *Error
	if errors.As(err, &failed) {
		return failed.Kind
	}
	return KindNetwork
}

func statusError(status int, detail string) *Error {
	kind, summary := classify(status)
	message := summary
	if detail != "" {
		message = summary + ": " + detail
	}
	return &Error{Kind: kind, Status: status, Message: message}
}

func classify(status int) (Kind, string) {
	switch {
	case status == http.StatusUnauthorized || status == http.StatusForbidden:
		return KindAuth, "The provider rejected the key, or the account may not use this model"
	case status == http.StatusTooManyRequests:
		return KindRateLimit, "The provider is rate limiting or out of quota. Wait a moment and try again"
	case status == http.StatusRequestTimeout:
		return KindTimeout, "The provider timed out"
	case status >= http.StatusInternalServerError:
		return KindServer, "The provider had a problem. Try again shortly"
	default:
		return KindRequest, fmt.Sprintf("The provider refused the request (%d)", status)
	}
}

func transportError(ctx context.Context, err error) *Error {
	switch {
	case errors.Is(ctx.Err(), context.Canceled):
		return failure(KindCanceled, "Cancelled")
	case errors.Is(ctx.Err(), context.DeadlineExceeded):
		return failure(KindTimeout, "The provider did not answer in time")
	default:
		return failure(KindNetwork, "Could not reach the provider: %s", cleanDetail(err.Error()))
	}
}

func cleanDetail(text string) string {
	collapsed := strings.Join(strings.Fields(text), " ")
	if len(collapsed) > detailLimit {
		return collapsed[:detailLimit]
	}
	return collapsed
}

func masked(err error, key string) error {
	var failed *Error
	if key == "" || !errors.As(err, &failed) {
		return err
	}
	scrubber := redact.New()
	scrubber.LearnSecret("key", key)
	copied := *failed
	copied.Message = scrubber.Text(failed.Message)
	return &copied
}
