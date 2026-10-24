package engine

import (
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"
)

const defaultDeviceInterval = 5

type DeviceAuthorization struct {
	DeviceCode              string `json:"deviceCode"`
	UserCode                string `json:"userCode"`
	VerificationURI         string `json:"verificationUri"`
	VerificationURIComplete string `json:"verificationUriComplete"`
	ExpiresAt               int64  `json:"expiresAt"`
	Interval                int    `json:"interval"`
	Error                   string `json:"error"`
}

type devicePayload struct {
	DeviceCode              string      `json:"device_code"`
	UserCode                string      `json:"user_code"`
	VerificationURI         string      `json:"verification_uri"`
	VerificationURL         string      `json:"verification_url"`
	VerificationURIComplete string      `json:"verification_uri_complete"`
	ExpiresIn               json.Number `json:"expires_in"`
	Interval                json.Number `json:"interval"`
	Error                   string      `json:"error"`
	ErrorDescription        string      `json:"error_description"`
}

func StartDeviceAuthorization(ctx context.Context, exchange TokenExchange, policy Policy) DeviceAuthorization {
	config := exchange.Config
	if strings.TrimSpace(config.DeviceURL) == "" {
		return DeviceAuthorization{Error: "enter the device authorization URL of the provider"}
	}
	var fields []row
	if config.Scope != "" {
		fields = append(fields, field("scope", config.Scope))
	}
	if config.Resource != "" {
		fields = append(fields, field("resource", config.Resource))
	}
	response := Send(ctx, clientRequest(exchange, config.DeviceURL, fields), policy)
	if response.Error != "" {
		return DeviceAuthorization{Error: response.Body}
	}
	return readDeviceAuthorization(response, time.Now())
}

func readDeviceAuthorization(response Response, now time.Time) DeviceAuthorization {
	var payload devicePayload
	if json.Unmarshal([]byte(response.Body), &payload) != nil {
		return DeviceAuthorization{Error: fmt.Sprintf("the device authorization endpoint answered %s without JSON", response.Status)}
	}
	if payload.DeviceCode == "" || payload.UserCode == "" {
		return DeviceAuthorization{Error: tokenFailure(response, tokenPayload{Error: payload.Error, ErrorDescription: payload.ErrorDescription})}
	}
	started := DeviceAuthorization{
		DeviceCode:              payload.DeviceCode,
		UserCode:                payload.UserCode,
		VerificationURI:         webAddress(cmp.Or(payload.VerificationURI, payload.VerificationURL)),
		VerificationURIComplete: webAddress(payload.VerificationURIComplete),
		ExpiresAt:               expiryAt(now, payload.ExpiresIn),
		Interval:                defaultDeviceInterval,
	}
	if started.VerificationURI == "" {
		return DeviceAuthorization{Error: "the provider did not return a web address to sign in at"}
	}
	if seconds, err := payload.Interval.Int64(); err == nil && seconds > 0 {
		started.Interval = int(seconds)
	}
	return started
}

func webURL(raw string) (*url.URL, bool) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Host == "" || (parsed.Scheme != "https" && parsed.Scheme != "http") {
		return nil, false
	}
	return parsed, true
}

func webAddress(raw string) string {
	parsed, ok := webURL(raw)
	if !ok {
		return ""
	}
	return parsed.String()
}
