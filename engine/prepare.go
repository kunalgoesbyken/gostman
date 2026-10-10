package engine

import (
	"encoding/base64"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"unicode/utf8"
)

const (
	methodGraphQL = "GRAPHQL"

	authBasic  = "basic"
	authBearer = "bearer"
	authAPIKey = "apikey"
	authQuery  = "query"

	headerContentType   = "Content-Type"
	headerAuthorization = "Authorization"
)

func Prepare(r Request) (Prepared, error) {
	variables, err := parseVariables(r.Variables)
	if err != nil {
		return Prepared{}, fmt.Errorf("environment variables are not valid JSON: %w", err)
	}
	substitute := substituter(variables)

	method := strings.ToUpper(strings.TrimSpace(r.Method))
	isGraphQL := method == methodGraphQL
	if isGraphQL {
		method = http.MethodPost
	}
	if method == "" {
		method = http.MethodGet
	}

	target, err := buildURL(r, substitute)
	if err != nil {
		return Prepared{}, err
	}

	headers, err := parsePairs(r.Headers)
	if err != nil {
		return Prepared{}, fmt.Errorf("headers are not valid: %w", err)
	}
	headers = substitutePairs(headers, substitute)

	body, contentType, err := buildBody(r, isGraphQL, substitute)
	if err != nil {
		return Prepared{}, err
	}
	if contentType != "" && !hasHeader(headers, headerContentType) {
		headers = append(headers, pair{headerContentType, contentType})
	}
	headers = applyAuth(r.Auth, substitute, headers, target)

	prepared := Prepared{Method: method, URL: target.String(), body: body}
	for _, header := range headers {
		prepared.Headers = append(prepared.Headers, HeaderEntry{Key: header.key, Value: header.value})
	}
	if utf8.Valid(body) {
		prepared.Body = string(body)
	}
	return prepared, nil
}

func buildURL(r Request, substitute func(string) string) (*url.URL, error) {
	raw := strings.TrimSpace(substitute(r.URL))
	if raw == "" {
		return nil, fmt.Errorf("enter a URL to send the request to")
	}
	if !strings.Contains(raw, "://") {
		raw = defaultScheme(raw) + "://" + raw
	}

	target, err := url.Parse(strings.ReplaceAll(raw, " ", "%20"))
	if err != nil || target.Host == "" {
		return nil, fmt.Errorf("%q is not a valid URL", raw)
	}
	if target.Scheme != "http" && target.Scheme != "https" {
		return nil, fmt.Errorf("unsupported URL scheme %q, use http or https", target.Scheme)
	}

	params, err := parsePairs(r.QueryParams)
	if err != nil {
		return nil, fmt.Errorf("query params are not valid: %w", err)
	}
	overrideQuery(target, substitutePairs(params, substitute))
	return target, nil
}

func defaultScheme(raw string) string {
	host := raw
	if end := strings.IndexAny(host, "/?#"); end >= 0 {
		host = host[:end]
	}
	if name, _, err := net.SplitHostPort(host); err == nil {
		host = name
	}
	if host == "localhost" || net.ParseIP(strings.Trim(host, "[]")) != nil {
		return "http"
	}
	return "https"
}

func overrideQuery(target *url.URL, params []pair) {
	if len(params) == 0 {
		return
	}
	query := target.Query()
	for _, param := range params {
		query.Del(param.key)
	}
	for _, param := range params {
		query.Add(param.key, param.value)
	}
	target.RawQuery = query.Encode()
}

func applyAuth(auth Auth, substitute func(string) string, headers []pair, target *url.URL) []pair {
	switch auth.Type {
	case authBasic:
		credentials := substitute(auth.Username) + ":" + substitute(auth.Password)
		encoded := base64.StdEncoding.EncodeToString([]byte(credentials))
		return setHeader(headers, headerAuthorization, "Basic "+encoded)
	case authBearer:
		return setHeader(headers, headerAuthorization, "Bearer "+substitute(auth.Token))
	case authAPIKey:
		key, value := substitute(auth.Key), substitute(auth.Value)
		if strings.TrimSpace(key) == "" {
			return headers
		}
		if auth.In == authQuery {
			overrideQuery(target, []pair{{key, value}})
			return headers
		}
		return setHeader(headers, key, value)
	default:
		return headers
	}
}

func hasHeader(headers []pair, name string) bool {
	for _, header := range headers {
		if strings.EqualFold(header.key, name) {
			return true
		}
	}
	return false
}

func setHeader(headers []pair, name, value string) []pair {
	kept := make([]pair, 0, len(headers)+1)
	for _, header := range headers {
		if !strings.EqualFold(header.key, name) {
			kept = append(kept, header)
		}
	}
	return append(kept, pair{name, value})
}
