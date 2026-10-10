package engine

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/http/cookiejar"
	"sync"
	"time"
	"unicode/utf8"
)

const (
	defaultTimeout     = 30 * time.Second
	defaultMaxResponse = 50 << 20
	maxRedirects       = 10
	maxRequestBody     = 10 << 20
)

type Policy struct {
	BlockPrivate     bool
	MaxResponseBytes int64
	MaxTimeout       time.Duration
}

type transportKey struct {
	blockPrivate bool
	insecureTLS  bool
}

var (
	transportsMu sync.Mutex
	transports   = map[transportKey]*http.Transport{}
)

func transportFor(key transportKey) *http.Transport {
	transportsMu.Lock()
	defer transportsMu.Unlock()

	if transport, ok := transports[key]; ok {
		return transport
	}
	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   15 * time.Second,
		ExpectContinueTimeout: time.Second,
		TLSClientConfig:       &tls.Config{InsecureSkipVerify: key.insecureTLS},
	}
	if key.blockPrivate {
		transport.Proxy = nil
		transport.DialContext = guardedDial
	}
	transports[key] = transport
	return transport
}

func Send(ctx context.Context, r Request, policy Policy) Response {
	started := time.Now()
	response := send(ctx, r, policy)
	response.DurationMs = time.Since(started).Milliseconds()
	return response
}

func send(ctx context.Context, r Request, policy Policy) Response {
	prepared, err := Prepare(r)
	if err != nil {
		return Failure(ErrorConfig, err.Error())
	}
	if len(prepared.body) > maxRequestBody {
		return Failure(ErrorConfig, "request body is larger than 10 MB")
	}

	ctx, cancel := context.WithTimeout(ctx, timeoutFor(r.Options, policy))
	defer cancel()

	outgoing, err := http.NewRequestWithContext(ctx, prepared.Method, prepared.URL, bytes.NewReader(prepared.body))
	if err != nil {
		return Failure(ErrorConfig, err.Error())
	}
	for _, header := range prepared.Headers {
		outgoing.Header.Add(header.Key, header.Value)
	}
	if host := outgoing.Header.Get("Host"); host != "" {
		outgoing.Host = host
	}

	var cookies []*http.Cookie
	jar, _ := cookiejar.New(nil)
	client := &http.Client{
		Jar:       jar,
		Transport: transportFor(transportKey{policy.BlockPrivate, r.Options.InsecureTLS}),
		CheckRedirect: func(next *http.Request, via []*http.Request) error {
			if r.Options.NoFollowRedirects {
				return http.ErrUseLastResponse
			}
			if len(via) >= maxRedirects {
				return fmt.Errorf("stopped after %d redirects", maxRedirects)
			}
			cookies = append(cookies, next.Response.Cookies()...)
			return nil
		},
	}

	incoming, err := client.Do(outgoing)
	if err != nil {
		return classify(ctx, err)
	}
	defer incoming.Body.Close()

	limit := policy.MaxResponseBytes
	if limit <= 0 {
		limit = defaultMaxResponse
	}
	body, err := io.ReadAll(io.LimitReader(incoming.Body, limit+1))
	if err != nil {
		return classify(ctx, err)
	}
	truncated := int64(len(body)) > limit
	if truncated {
		body = body[:limit]
	}

	response := Response{
		Status:     incoming.Status,
		StatusCode: incoming.StatusCode,
		Headers:    flattenHeaders(incoming.Header),
		Cookies:    describeCookies(append(cookies, incoming.Cookies()...)),
		Size:       int64(len(body)),
		URL:        incoming.Request.URL.String(),
		Truncated:  truncated,
	}
	response.ContentType = mediaType(incoming.Header.Get(headerContentType), body)
	response.Body, response.BodyEncoding = encodeBody(body, truncated)
	return response
}

func timeoutFor(options Options, policy Policy) time.Duration {
	timeout := defaultTimeout
	if options.TimeoutMs > 0 {
		timeout = time.Duration(options.TimeoutMs) * time.Millisecond
	}
	if policy.MaxTimeout > 0 && timeout > policy.MaxTimeout {
		return policy.MaxTimeout
	}
	return timeout
}

func Failure(kind, message string) Response {
	return Response{Status: "Error", Error: kind, Body: message, BodyEncoding: EncodingUTF8}
}

func classify(ctx context.Context, err error) Response {
	switch {
	case errors.Is(err, errBlockedAddress):
		return Failure(ErrorBlocked, err.Error())
	case errors.Is(ctx.Err(), context.DeadlineExceeded):
		return Failure(ErrorTimeout, "the request timed out")
	case errors.Is(ctx.Err(), context.Canceled):
		return Failure(ErrorCancelled, "the request was cancelled")
	default:
		return Failure(ErrorNetwork, err.Error())
	}
}

func flattenHeaders(header http.Header) []HeaderEntry {
	var entries []HeaderEntry
	for key, values := range header {
		for _, value := range values {
			entries = append(entries, HeaderEntry{Key: key, Value: value})
		}
	}
	return entries
}

func describeCookies(cookies []*http.Cookie) []CookieInfo {
	var described []CookieInfo
	for _, cookie := range cookies {
		expires := ""
		if !cookie.Expires.IsZero() {
			expires = cookie.Expires.UTC().Format(time.RFC1123)
		}
		described = append(described, CookieInfo{
			Name:     cookie.Name,
			Value:    cookie.Value,
			Domain:   cookie.Domain,
			Path:     cookie.Path,
			Expires:  expires,
			Secure:   cookie.Secure,
			HttpOnly: cookie.HttpOnly,
		})
	}
	return described
}

func mediaType(contentType string, body []byte) string {
	if parsed, _, err := mime.ParseMediaType(contentType); err == nil {
		return parsed
	}
	if len(body) == 0 {
		return ""
	}
	parsed, _, _ := mime.ParseMediaType(http.DetectContentType(body))
	return parsed
}

func encodeBody(body []byte, truncated bool) (string, string) {
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
