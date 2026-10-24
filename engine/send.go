package engine

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"time"
	"unicode/utf8"

	"github.com/kunalgoesbyken/gostman/redact"
)

const (
	defaultTimeout     = 30 * time.Second
	defaultMaxResponse = 50 << 20
	maxRedirects       = 10
	maxRequestBody     = 10 << 20
	maxEncodedBody     = maxRequestBody * 3 / 2
)

var errBodyTooLarge = errors.New("request body is larger than 10 MB")

type Policy struct {
	BlockPrivate      bool
	MaxResponseBytes  int64
	MaxTimeout        time.Duration
	Network           *Network
	Permit            func(host string) bool
	RevealSecrets     bool
	MaxStreamDuration time.Duration
	MinStreamRetry    time.Duration
	RunCommands       bool
	ReadFile          FileReader
}

func (p Policy) fileReader() FileReader {
	if p.ReadFile == nil {
		return refusing(errFilesUnavailable)
	}
	return p.ReadFile
}

func (p Policy) refusal(host string) error {
	if p.Permit == nil || p.Permit(host) {
		return nil
	}
	return fmt.Errorf("%w: %s", errHostNotPermitted, host)
}

func Send(ctx context.Context, r Request, policy Policy) Response {
	started := time.Now()
	response := send(ctx, r, policy)
	response.DurationMs = time.Since(started).Milliseconds()
	return response
}

func send(ctx context.Context, r Request, policy Policy) Response {
	timeline := newRecorder(policy.RevealSecrets)
	response := exchange(ctx, r, policy, timeline)
	response.Timeline = timeline.finish()
	return response
}

func exchange(ctx context.Context, r Request, policy Policy, timeline *recorder) Response {
	ctx, cancel := context.WithTimeout(ctx, policy.Timeout(r.Options))
	defer cancel()

	outgoing, client, cookies, err := newExchange(ctx, r, policy, timeline)
	if err != nil {
		return Failure(ErrorConfig, err.Error())
	}
	incoming, err := client.Do(outgoing)
	if err != nil {
		return classify(ctx, err)
	}
	defer incoming.Body.Close()

	return collect(ctx, incoming, cookies, policy.ResponseLimit())
}

func collect(ctx context.Context, incoming *http.Response, cookies *cookieLog, limit int64) Response {
	body, err := io.ReadAll(io.LimitReader(incoming.Body, limit+1))
	if err != nil {
		return classify(ctx, err)
	}
	cookies.record(incoming)
	truncated := int64(len(body)) > limit
	if truncated {
		body = body[:limit]
	}

	response := describe(incoming, cookies)
	response.Size = int64(len(body))
	response.Truncated = truncated
	response.ContentType = MediaType(incoming.Header.Get(headerContentType), body)
	response.Body, response.BodyEncoding = EncodeBody(body, truncated)
	return response
}

func newExchange(ctx context.Context, r Request, policy Policy, timeline *recorder) (*http.Request, *http.Client, *cookieLog, error) {
	if len(r.Body) > maxEncodedBody {
		return nil, nil, nil, errBodyTooLarge
	}
	r, err := Resolve(r)
	if err != nil {
		return nil, nil, nil, err
	}
	prepared, err := prepare(r, policy.fileReader())
	if err != nil {
		return nil, nil, nil, err
	}
	if len(prepared.body) > maxRequestBody {
		return nil, nil, nil, errBodyTooLarge
	}

	outgoing, err := http.NewRequestWithContext(ctx, prepared.Method, prepared.URL, bytes.NewReader(prepared.body))
	if err != nil {
		return nil, nil, nil, err
	}
	for _, header := range prepared.Headers {
		outgoing.Header.Add(header.Key, header.Value)
	}
	if host := outgoing.Header.Get("Host"); host != "" {
		outgoing.Host = host
	}

	cookies := &cookieLog{now: time.Now()}
	client := &http.Client{
		Jar:       newJar(r.Cookies, cookies.now),
		Transport: authRoute(r, outgoing.URL, timeline.wrap(policy.route(r.Options.InsecureTLS))),
		CheckRedirect: func(next *http.Request, via []*http.Request) error {
			if r.Options.NoFollowRedirects {
				return http.ErrUseLastResponse
			}
			if len(via) >= maxRedirects {
				return fmt.Errorf("stopped after %d redirects", maxRedirects)
			}
			if originOf(next.URL) != originOf(via[0].URL) {
				dropCredentials(next.Header)
			}
			cookies.record(next.Response)
			return nil
		},
	}
	return outgoing, client, cookies, nil
}

func dropCredentials(header http.Header) {
	for name := range header {
		if redact.IsSensitiveName(name) {
			header.Del(name)
		}
	}
}

func describe(incoming *http.Response, cookies *cookieLog) Response {
	return Response{
		Status:     incoming.Status,
		StatusCode: incoming.StatusCode,
		Headers:    FlattenHeaders(incoming.Header),
		Cookies:    cookies.entries,
		URL:        incoming.Request.URL.String(),
	}
}

func (p Policy) Timeout(options Options) time.Duration {
	timeout := defaultTimeout
	if options.TimeoutMs > 0 {
		timeout = time.Duration(options.TimeoutMs) * time.Millisecond
	}
	if p.MaxTimeout > 0 && timeout > p.MaxTimeout {
		return p.MaxTimeout
	}
	return timeout
}

func (p Policy) ResponseLimit() int64 {
	if p.MaxResponseBytes > 0 {
		return p.MaxResponseBytes
	}
	return defaultMaxResponse
}

func Failure(kind, message string) Response {
	return Response{Status: "Error", Error: kind, Body: message, BodyEncoding: EncodingUTF8}
}

func classify(ctx context.Context, err error) Response {
	switch {
	case errors.Is(err, errBlockedAddress), errors.Is(err, errHostNotPermitted):
		return Failure(ErrorBlocked, err.Error())
	case errors.Is(ctx.Err(), context.DeadlineExceeded):
		return Failure(ErrorTimeout, "the request timed out")
	case errors.Is(ctx.Err(), context.Canceled):
		return Failure(ErrorCancelled, "the request was cancelled")
	default:
		return networkFailure(err)
	}
}

func FlattenHeaders(header http.Header) []HeaderEntry {
	var entries []HeaderEntry
	for key, values := range header {
		for _, value := range values {
			entries = append(entries, HeaderEntry{Key: key, Value: value})
		}
	}
	return entries
}

func MediaType(contentType string, body []byte) string {
	if parsed, _, err := mime.ParseMediaType(contentType); err == nil {
		return parsed
	}
	if len(body) == 0 {
		return ""
	}
	parsed, _, _ := mime.ParseMediaType(http.DetectContentType(body))
	return parsed
}

func EncodeBody(body []byte, truncated bool) (string, string) {
	if truncated {
		body = trimPartialRune(body)
	}
	if utf8.Valid(body) && !bytes.ContainsRune(body, 0) {
		return string(body), EncodingUTF8
	}
	return base64.StdEncoding.EncodeToString(body), EncodingBase64
}

func trimPartialRune(body []byte) []byte {
	for cut := 0; cut < utf8.UTFMax && cut < len(body); cut++ {
		if utf8.Valid(body[:len(body)-cut]) {
			return body[:len(body)-cut]
		}
	}
	return body
}
