package rpc

import (
	"context"
	"errors"
	"fmt"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/locales"
	"google.golang.org/grpc/status"
)

type failure struct {
	kind    string
	message string
	said    *locales.Message
}

func (f *failure) Error() string { return f.message }

func (f *failure) response() engine.Response {
	if f.said != nil {
		return engine.Failed(f.kind, *f.said)
	}
	return engine.Failure(f.kind, f.message)
}

func configError(format string, args ...any) error {
	return &failure{kind: engine.ErrorConfig, message: fmt.Sprintf(format, args...)}
}

func localizedConfigError(code locales.Code, params locales.Params) error {
	said := locales.New(code, params)
	return &failure{kind: engine.ErrorConfig, message: said.String(), said: &said}
}

func classify(ctx context.Context, err error) *failure {
	var known *failure
	switch {
	case errors.As(err, &known):
		return known
	case engine.IsBlockedAddress(err):
		return &failure{kind: engine.ErrorBlocked, message: err.Error()}
	case errors.Is(ctx.Err(), context.DeadlineExceeded):
		return &failure{kind: engine.ErrorTimeout, message: "the request timed out"}
	case errors.Is(ctx.Err(), context.Canceled):
		return &failure{kind: engine.ErrorCancelled, message: "the request was cancelled"}
	default:
		return &failure{kind: engine.ErrorNetwork, message: describeError(err)}
	}
}

func describeError(err error) string {
	if rpcStatus, ok := status.FromError(err); ok {
		return fmt.Sprintf("%s: %s", codeName(rpcStatus.Code()), rpcStatus.Message())
	}
	return engine.DescribeNetworkError(err)
}
