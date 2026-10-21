package engine

import (
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

const (
	authEdgeGrid = "edgegrid"

	edgeGridAlgorithm   = "EG1-HMAC-SHA256"
	edgeGridTimeLayout  = "20060102T15:04:05-0700"
	edgeGridDefaultBody = 131072
)

type EdgeGridAuth struct {
	ClientToken   string `json:"clientToken"`
	ClientSecret  string `json:"clientSecret"`
	AccessToken   string `json:"accessToken"`
	Nonce         string `json:"nonce"`
	Timestamp     string `json:"timestamp"`
	HeadersToSign string `json:"headersToSign"`
	MaxBody       string `json:"maxBody"`
}

func signEdgeGrid(config EdgeGridAuth, substitute func(string) string, method string, target *url.URL, headers []pair, body []byte) []pair {
	clientToken := strings.TrimSpace(substitute(config.ClientToken))
	accessToken := strings.TrimSpace(substitute(config.AccessToken))
	clientSecret := substitute(config.ClientSecret)
	if clientToken == "" || accessToken == "" || clientSecret == "" {
		return headers
	}
	timestamp := strings.TrimSpace(substitute(config.Timestamp))
	if timestamp == "" {
		timestamp = clock().UTC().Format(edgeGridTimeLayout)
	}
	nonce := strings.TrimSpace(substitute(config.Nonce))
	if nonce == "" {
		nonce = randomHex(16)
	}

	prefix := edgeGridAlgorithm + " client_token=" + clientToken + ";access_token=" + accessToken + ";timestamp=" + timestamp + ";nonce=" + nonce + ";"

	data := strings.Join([]string{
		strings.ToUpper(method),
		target.Scheme,
		strings.ToLower(target.Host),
		target.RequestURI(),
		edgeGridHeaders(headers, substitute(config.HeadersToSign)),
		edgeGridContentHash(method, body, substitute(config.MaxBody)),
		prefix,
	}, "\t")

	signingKey := base64.StdEncoding.EncodeToString(hmacSHA256([]byte(clientSecret), timestamp))
	signature := base64.StdEncoding.EncodeToString(hmacSHA256([]byte(signingKey), data))
	return setHeader(headers, headerAuthorization, prefix+"signature="+signature)
}

func edgeGridHeaders(headers []pair, names string) string {
	var canonical []string
	for _, name := range strings.Split(names, ",") {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		for _, header := range headers {
			if strings.EqualFold(header.key, name) {
				canonical = append(canonical, strings.ToLower(name)+":"+collapseSpaces(header.value))
				break
			}
		}
	}
	return strings.Join(canonical, "\t")
}

func edgeGridContentHash(method string, body []byte, maxBody string) string {
	if !strings.EqualFold(method, http.MethodPost) || len(body) == 0 {
		return ""
	}
	limit, err := strconv.Atoi(strings.TrimSpace(maxBody))
	if err != nil || limit <= 0 {
		limit = edgeGridDefaultBody
	}
	if len(body) > limit {
		body = body[:limit]
	}
	sum := sha256.Sum256(body)
	return base64.StdEncoding.EncodeToString(sum[:])
}
