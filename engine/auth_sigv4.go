package engine

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

const (
	authAWSV4 = "awsv4"

	sigV4Algorithm = "AWS4-HMAC-SHA256"
	sigV4Date      = "20060102T150405Z"
	sigV4DayLength = 8

	sigV4ObjectService = "s3"
	sigV4Terminator    = "aws4_request"
	sigV4KeyPrefix     = "AWS4"
	sigV4HeaderPrefix  = "x-amz-"

	sigV4HeaderDate    = "X-Amz-Date"
	sigV4HeaderToken   = "X-Amz-Security-Token"
	sigV4HeaderContent = "X-Amz-Content-Sha256"
)

var clock = time.Now

type AWSAuth struct {
	AccessKey    string `json:"accessKey"`
	SecretKey    string `json:"secretKey"`
	SessionToken string `json:"sessionToken"`
	Region       string `json:"region"`
	Service      string `json:"service"`
}

func SignAWS(config AWSAuth, request *http.Request, body []byte) {
	var headers []pair
	for name, values := range request.Header {
		for _, value := range values {
			headers = append(headers, pair{name, value})
		}
	}
	keep := func(value string) string { return value }
	for _, header := range signSigV4(config, keep, request.Method, request.URL, headers, body) {
		request.Header.Set(header.key, header.value)
	}
}

func signSigV4(config AWSAuth, substitute func(string) string, method string, target *url.URL, headers []pair, body []byte) []pair {
	accessKey := strings.TrimSpace(substitute(config.AccessKey))
	secretKey := substitute(config.SecretKey)
	if accessKey == "" || secretKey == "" {
		return headers
	}
	region := strings.TrimSpace(substitute(config.Region))
	service := strings.TrimSpace(substitute(config.Service))
	if region == "" || service == "" {
		return headers
	}
	sessionToken := strings.TrimSpace(substitute(config.SessionToken))

	stamp := clock().UTC().Format(sigV4Date)
	payloadHash := hexSHA256(body)

	headers = setHeader(headers, sigV4HeaderDate, stamp)
	if sessionToken != "" {
		headers = setHeader(headers, sigV4HeaderToken, sessionToken)
	}
	if service == sigV4ObjectService {
		headers = setHeader(headers, sigV4HeaderContent, payloadHash)
	}

	canonicalHeaders, signedHeaders := canonicalSigV4Headers(headers, target.Host)
	canonical := strings.Join([]string{
		method,
		canonicalSigV4Path(target, service),
		canonicalSigV4Query(target),
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")

	scope := stamp[:sigV4DayLength] + "/" + region + "/" + service + "/" + sigV4Terminator
	toSign := sigV4Algorithm + "\n" + stamp + "\n" + scope + "\n" + hexSHA256([]byte(canonical))

	signature := hex.EncodeToString(hmacSHA256(sigV4SigningKey(secretKey, stamp[:sigV4DayLength], region, service), toSign))

	value := sigV4Algorithm + " Credential=" + accessKey + "/" + scope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature
	return setHeader(headers, headerAuthorization, value)
}

func sigV4SigningKey(secretKey, day, region, service string) []byte {
	key := hmacSHA256([]byte(sigV4KeyPrefix+secretKey), day)
	for _, part := range []string{region, service, sigV4Terminator} {
		key = hmacSHA256(key, part)
	}
	return key
}

func canonicalSigV4Headers(headers []pair, host string) (string, string) {
	values := map[string]string{"host": host}
	for _, header := range headers {
		name := strings.ToLower(header.key)
		if name == "content-type" || name == "content-md5" || strings.HasPrefix(name, sigV4HeaderPrefix) {
			values[name] = collapseSpaces(header.value)
		}
	}
	names := make([]string, 0, len(values))
	for name := range values {
		names = append(names, name)
	}
	sort.Strings(names)
	var canonical strings.Builder
	for _, name := range names {
		canonical.WriteString(name + ":" + values[name] + "\n")
	}
	return canonical.String(), strings.Join(names, ";")
}

func collapseSpaces(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

func canonicalSigV4Path(target *url.URL, service string) string {
	path := target.Path
	if path == "" {
		return "/"
	}
	segments := strings.Split(path, "/")
	for i, segment := range segments {
		segments[i] = percentEncode(segment)
		if service != sigV4ObjectService {
			segments[i] = percentEncode(segments[i])
		}
	}
	return strings.Join(segments, "/")
}

func canonicalSigV4Query(target *url.URL) string {
	var entries []string
	for key, values := range target.Query() {
		for _, value := range values {
			entries = append(entries, percentEncode(key)+"="+percentEncode(value))
		}
	}
	sort.Strings(entries)
	return strings.Join(entries, "&")
}

func percentEncode(value string) string {
	var builder strings.Builder
	for i := 0; i < len(value); i++ {
		c := value[i]
		switch {
		case c >= 'A' && c <= 'Z', c >= 'a' && c <= 'z', c >= '0' && c <= '9', c == '-', c == '_', c == '.', c == '~':
			builder.WriteByte(c)
		default:
			builder.WriteString("%" + strings.ToUpper(hex.EncodeToString([]byte{c})))
		}
	}
	return builder.String()
}

func hexSHA256(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func hmacSHA256(key []byte, data string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(data))
	return mac.Sum(nil)
}
