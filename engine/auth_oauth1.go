package engine

import (
	"crypto"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
)

const (
	authOAuth1 = "oauth1"

	oauth1NonceSize  = 16
	oauth1HMACSHA1   = "HMAC-SHA1"
	oauth1HMACSHA256 = "HMAC-SHA256"
	oauth1RSASHA1    = "RSA-SHA1"
	oauth1RSASHA256  = "RSA-SHA256"
	oauth1Plaintext  = "PLAINTEXT"
	oauth1InQuery    = "query"
	oauth1InBody     = "body"
	contentTypeForm  = "application/x-www-form-urlencoded"
	oauth1Version    = "1.0"
)

type OAuth1Auth struct {
	ConsumerKey     string `json:"consumerKey"`
	ConsumerSecret  string `json:"consumerSecret"`
	Token           string `json:"token"`
	TokenSecret     string `json:"tokenSecret"`
	SignatureMethod string `json:"signatureMethod"`
	PrivateKey      string `json:"privateKey"`
	Realm           string `json:"realm"`
	Callback        string `json:"callback"`
	Verifier        string `json:"verifier"`
	Nonce           string `json:"nonce"`
	Timestamp       string `json:"timestamp"`
	In              string `json:"in"`
}

func signOAuth1(config OAuth1Auth, substitute func(string) string, method string, target *url.URL, headers []pair, body []byte) ([]pair, []byte) {
	if strings.TrimSpace(substitute(config.ConsumerKey)) == "" {
		return headers, body
	}
	signatureMethod := strings.ToUpper(strings.TrimSpace(config.SignatureMethod))
	if signatureMethod == "" {
		signatureMethod = oauth1HMACSHA1
	}
	oauth := oauth1Params(config, substitute, signatureMethod)
	formBody := isFormContent(headers) && len(body) > 0

	base := strings.ToUpper(method) + "&" + percentEncode(oauth1BaseURI(target)) + "&" + percentEncode(normalizeOAuth1Params(oauth1SignedParams(oauth, target, body, formBody)))
	signature, err := oauth1Signature(signatureMethod, base, substitute(config.ConsumerSecret), substitute(config.TokenSecret), substitute(config.PrivateKey))
	if err != nil {
		return headers, body
	}
	oauth = append(oauth, pair{"oauth_signature", signature})

	switch config.In {
	case oauth1InQuery:
		overrideQuery(target, oauth)
	case oauth1InBody:
		return placeOAuth1InBody(oauth, headers, body, formBody)
	default:
		headers = setHeader(headers, headerAuthorization, oauth1Header(oauth, strings.TrimSpace(substitute(config.Realm))))
	}
	return headers, body
}

func oauth1Params(config OAuth1Auth, substitute func(string) string, signatureMethod string) []pair {
	nonce := strings.TrimSpace(substitute(config.Nonce))
	if nonce == "" {
		nonce = randomHex(oauth1NonceSize)
	}
	timestamp := strings.TrimSpace(substitute(config.Timestamp))
	if timestamp == "" {
		timestamp = strconv.FormatInt(clock().Unix(), 10)
	}
	params := []pair{
		{"oauth_consumer_key", substitute(config.ConsumerKey)},
		{"oauth_nonce", nonce},
		{"oauth_signature_method", signatureMethod},
		{"oauth_timestamp", timestamp},
		{"oauth_version", oauth1Version},
	}
	optional := []pair{
		{"oauth_token", substitute(config.Token)},
		{"oauth_callback", substitute(config.Callback)},
		{"oauth_verifier", substitute(config.Verifier)},
	}
	for _, field := range optional {
		if field.value != "" {
			params = append(params, field)
		}
	}
	return params
}

func oauth1SignedParams(oauth []pair, target *url.URL, body []byte, formBody bool) []pair {
	signed := append([]pair{}, oauth...)
	signed = append(signed, queryPairs(target.Query())...)
	if !formBody {
		return signed
	}
	values, err := url.ParseQuery(string(body))
	if err != nil {
		return signed
	}
	return append(signed, queryPairs(values)...)
}

func queryPairs(values url.Values) []pair {
	var pairs []pair
	for key, list := range values {
		for _, value := range list {
			pairs = append(pairs, pair{key, value})
		}
	}
	return pairs
}

func placeOAuth1InBody(oauth []pair, headers []pair, body []byte, formBody bool) ([]pair, []byte) {
	encoded := encodeOAuth1Pairs(oauth, "&", false)
	switch {
	case len(body) == 0:
		if !hasHeader(headers, headerContentType) {
			headers = append(headers, pair{headerContentType, contentTypeForm})
		}
		return headers, []byte(encoded)
	case formBody:
		return headers, []byte(string(body) + "&" + encoded)
	}
	return setHeader(headers, headerAuthorization, oauth1Header(oauth, "")), body
}

func isFormContent(headers []pair) bool {
	for _, header := range headers {
		if strings.EqualFold(header.key, headerContentType) {
			return strings.HasPrefix(strings.ToLower(strings.TrimSpace(header.value)), contentTypeForm)
		}
	}
	return false
}

func oauth1Header(oauth []pair, realm string) string {
	value := "OAuth "
	if realm != "" {
		value += `realm="` + realm + `", `
	}
	return value + encodeOAuth1Pairs(oauth, ", ", true)
}

func encodeOAuth1Pairs(params []pair, separator string, quoted bool) string {
	parts := make([]string, 0, len(params))
	for _, param := range params {
		encoded := percentEncode(param.value)
		if quoted {
			encoded = `"` + encoded + `"`
		}
		parts = append(parts, percentEncode(param.key)+"="+encoded)
	}
	return strings.Join(parts, separator)
}

func oauth1BaseURI(target *url.URL) string {
	scheme := strings.ToLower(target.Scheme)
	host := strings.TrimSuffix(strings.ToLower(target.Host), ":"+defaultPorts[scheme])
	path := target.EscapedPath()
	if path == "" {
		path = "/"
	}
	return scheme + "://" + host + path
}

func normalizeOAuth1Params(params []pair) string {
	encoded := make([][2]string, 0, len(params))
	for _, param := range params {
		encoded = append(encoded, [2]string{percentEncode(param.key), percentEncode(param.value)})
	}
	sort.Slice(encoded, func(i, j int) bool {
		if encoded[i][0] != encoded[j][0] {
			return encoded[i][0] < encoded[j][0]
		}
		return encoded[i][1] < encoded[j][1]
	})
	parts := make([]string, len(encoded))
	for i, entry := range encoded {
		parts[i] = entry[0] + "=" + entry[1]
	}
	return strings.Join(parts, "&")
}

func oauth1Signature(method, base, consumerSecret, tokenSecret, privateKey string) (string, error) {
	secret := percentEncode(consumerSecret) + "&" + percentEncode(tokenSecret)
	switch method {
	case oauth1Plaintext:
		return secret, nil
	case oauth1HMACSHA1:
		mac := hmac.New(sha1.New, []byte(secret))
		mac.Write([]byte(base))
		return base64.StdEncoding.EncodeToString(mac.Sum(nil)), nil
	case oauth1HMACSHA256:
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write([]byte(base))
		return base64.StdEncoding.EncodeToString(mac.Sum(nil)), nil
	case oauth1RSASHA1, oauth1RSASHA256:
		key, err := parseRSAKey(privateKey)
		if err != nil {
			return "", err
		}
		algorithm, sum := crypto.SHA1, sha1.Sum([]byte(base))
		digest := sum[:]
		if method == oauth1RSASHA256 {
			full := sha256.Sum256([]byte(base))
			algorithm, digest = crypto.SHA256, full[:]
		}
		signature, err := rsa.SignPKCS1v15(rand.Reader, key, algorithm, digest)
		if err != nil {
			return "", err
		}
		return base64.StdEncoding.EncodeToString(signature), nil
	}
	return "", fmt.Errorf("unsupported OAuth 1 signature method %q", method)
}

func parseRSAKey(text string) (*rsa.PrivateKey, error) {
	parsed, err := parsePrivateKey(text)
	if err != nil {
		return nil, err
	}
	key, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("the private key is not an RSA key")
	}
	return key, nil
}
