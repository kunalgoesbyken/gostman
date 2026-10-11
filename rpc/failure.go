package rpc

import (
	"context"
	"errors"
	"fmt"

	"github.com/krockxz/gostman/engine"
	"google.golang.org/grpc/status"
)

type failure struct {
	kind    string
	message string
}

func (f *failure) Error() string { return f.message }

func (f *failure) response() engine.Response {
	return engine.Failure(f.kind, f.message)
}

func configError(format string, args ...any) error {
	return &failure{engine.ErrorConfig, fmt.Sprintf(format, args...)}
}

func classify(ctx context.Context, err error) *failure {
	var known *failure
	switch {
	case errors.As(err, &known):
		return known
	case engine.IsBlockedAddress(err):
		return &failure{engine.ErrorBlocked, err.Error()}
	case errors.Is(ctx.Err(), context.DeadlineExceeded):
		return &failure{engine.ErrorTimeout, "the request timed out"}
	case errors.Is(ctx.Err(), context.Canceled):
		return &failure{engine.ErrorCancelled, "the request was cancelled"}
	default:
		return &failure{engine.ErrorNetwork, describeError(err)}
	}
}

func describeError(err error) string {
	if rpcStatus, ok := status.FromError(err); ok {
		return fmt.Sprintf("%s: %s", codeName(rpcStatus.Code()), rpcStatus.Message())
	}
	return err.Error()
}
