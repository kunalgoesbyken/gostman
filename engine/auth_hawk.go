package engine

import (
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"hash"
	"net/url"
	"strconv"
	"strings"
)

const (
	authHawk = "hawk"

	hawkHeaderPrefix  = "hawk.1.header"
	hawkPayloadPrefix = "hawk.1.payload"
	hawkSHA1          = "sha1"
	hawkIncludeHash   = "include"
	hawkNonceSize     = 6
)

type HawkAuth struct {
	ID          string `json:"id"`
	Key         string `json:"key"`
	Algorithm   string `json:"algorithm"`
	Ext         string `json:"ext"`
	App         string `json:"app"`
	Dlg         string `json:"dlg"`
	Nonce       string `json:"nonce"`
	Timestamp   string `json:"timestamp"`
	PayloadHash string `json:"payloadHash"`
}

func signHawk(config HawkAuth, substitute func(string) string, method string, target *url.URL, headers []pair, body []byte) []pair {
	id, key := strings.TrimSpace(substitute(config.ID)), substitute(config.Key)
	if id == "" || key == "" {
		return headers
	}
	newHash := sha256.New
	if strings.EqualFold(strings.TrimSpace(config.Algorithm), hawkSHA1) {
		newHash = sha1.New
	}
	timestamp := strings.TrimSpace(substitute(config.Timestamp))
	if timestamp == "" {
		timestamp = strconv.FormatInt(clock().Unix(), 10)
	}
	nonce := strings.TrimSpace(substitute(config.Nonce))
	if nonce == "" {
		nonce = randomHex(hawkNonceSize)
	}
	ext, app, dlg := substitute(config.Ext), strings.TrimSpace(substitute(config.App)), strings.TrimSpace(substitute(config.Dlg))
	payloadHash := ""
	if config.PayloadHash == hawkIncludeHash {
		payloadHash = hawkPayload(newHash, headerValue(headers, headerContentType), body)
	}

	normalized := []string{hawkHeaderPrefix, timestamp, nonce, strings.ToUpper(method), target.RequestURI(), strings.ToLower(target.Hostname()), hawkPort(target), payloadHash, hawkEscape(ext)}
	if app != "" {
		normalized = append(normalized, app, dlg)
	}
	mac := hmac.New(newHash, []byte(key))
	mac.Write([]byte(strings.Join(normalized, "\n") + "\n"))

	attributes := []pair{{"id", id}, {"ts", timestamp}, {"nonce", nonce}}
	if payloadHash != "" {
		attributes = append(attributes, pair{"hash", payloadHash})
	}
	if ext != "" {
		attributes = append(attributes, pair{"ext", ext})
	}
	attributes = append(attributes, pair{"mac", base64.StdEncoding.EncodeToString(mac.Sum(nil))})
	if app != "" {
		attributes = append(attributes, pair{"app", app})
		if dlg != "" {
			attributes = append(attributes, pair{"dlg", dlg})
		}
	}
	parts := make([]string, len(attributes))
	for i, attribute := range attributes {
		parts[i] = attribute.key + `="` + hawkQuote(attribute.value) + `"`
	}
	return setHeader(headers, headerAuthorization, "Hawk "+strings.Join(parts, ", "))
}

func hawkPayload(newHash func() hash.Hash, contentType string, body []byte) string {
	mediaType, _, _ := strings.Cut(contentType, ";")
	digest := newHash()
	digest.Write([]byte(hawkPayloadPrefix + "\n" + strings.ToLower(strings.TrimSpace(mediaType)) + "\n"))
	digest.Write(body)
	digest.Write([]byte("\n"))
	return base64.StdEncoding.EncodeToString(digest.Sum(nil))
}

func hawkPort(target *url.URL) string {
	if port := target.Port(); port != "" {
		return port
	}
	return defaultPorts[strings.ToLower(target.Scheme)]
}

func hawkEscape(text string) string {
	return strings.NewReplacer(`\`, `\\`, "\n", `\n`).Replace(text)
}

func hawkQuote(text string) string {
	return strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(text)
}

func headerValue(headers []pair, name string) string {
	for _, header := range headers {
		if strings.EqualFold(header.key, name) {
			return header.value
		}
	}
	return ""
}
