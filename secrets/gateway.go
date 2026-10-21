package secrets

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/loopback"
)

const (
	requestTimeout   = 15 * time.Second
	maxResponseBytes = 1 << 20
	maxValueBytes    = 64 << 10
	schemeHTTPS      = "https"
	schemeHTTP       = "http"
)

var errRedirect = errors.New("the service redirected the request, which is not followed")

type gateway struct {
	client *http.Client
}

type reply struct {
	status int
	body   []byte
}

func newGateway() *gateway {
	client := &http.Client{
		Timeout:       requestTimeout,
		CheckRedirect: func(*http.Request, []*http.Request) error { return errRedirect },
	}
	return &gateway{client: client}
}

func (g *gateway) exchange(ctx context.Context, request *http.Request) (reply, error) {
	response, err := g.client.Do(request.WithContext(ctx))
	if err != nil {
		return reply{}, transportProblem(ctx, err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
	if err != nil {
		return reply{}, transportProblem(ctx, err)
	}
	if len(body) > maxResponseBytes {
		return reply{}, fmt.Errorf("the answer is larger than %d bytes", maxResponseBytes)
	}
	return reply{status: response.StatusCode, body: body}, nil
}

func transportProblem(ctx context.Context, err error) error {
	switch {
	case errors.Is(ctx.Err(), context.Canceled):
		return context.Canceled
	case errors.Is(err, errRedirect):
		return errRedirect
	case errors.Is(err, context.DeadlineExceeded) || isTimeout(err):
		return errors.New("the service did not answer in time")
	}
	var failure *url.Error
	if errors.As(err, &failure) {
		err = failure.Err
	}
	return fmt.Errorf("the service could not be reached: %w", err)
}

func isTimeout(err error) bool {
	var timeout interface{ Timeout() bool }
	return errors.As(err, &timeout) && timeout.Timeout()
}

func (r reply) problem() error {
	switch {
	case r.status >= 200 && r.status < 300:
		return nil
	case r.status == http.StatusUnauthorized || r.status == http.StatusForbidden:
		return fmt.Errorf("access denied (HTTP %d); check the credentials of the connection", r.status)
	case r.status == http.StatusNotFound:
		return fmt.Errorf("not found (HTTP %d)", r.status)
	case r.status == http.StatusTooManyRequests:
		return fmt.Errorf("the service is rate limiting requests (HTTP %d)", r.status)
	case r.status >= 500:
		return fmt.Errorf("the service failed (HTTP %d)", r.status)
	default:
		return fmt.Errorf("unexpected answer (HTTP %d)", r.status)
	}
}

func parseAddress(raw, label string) (*url.URL, error) {
	address, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || address.Host == "" || address.User != nil {
		return nil, fmt.Errorf("the %s %q is not a valid address", label, raw)
	}
	isSecure := address.Scheme == schemeHTTPS || (address.Scheme == schemeHTTP && loopback.IsHost(address.Host))
	if !isSecure {
		return nil, fmt.Errorf("the %s %q must use https", label, raw)
	}
	return address, nil
}

func endpoint(base *url.URL, segments ...string) *url.URL {
	target := *base
	target.RawQuery = ""
	target.Path = strings.TrimRight(base.Path, "/") + "/" + strings.Join(segments, "/")
	return &target
}
