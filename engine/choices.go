package engine

import (
	"fmt"
	"slices"
	"strings"
)

type HTTPVersion string

const (
	HTTPVersionAuto HTTPVersion = ""
	HTTPVersion1    HTTPVersion = "1.1"
	HTTPVersion2    HTTPVersion = "2"
)

type RPCTransport string

const (
	TransportGRPC        RPCTransport = ""
	TransportGRPCWeb     RPCTransport = "grpc-web"
	TransportGRPCWebText RPCTransport = "grpc-web-text"
	TransportConnect     RPCTransport = "connect"
)

func parseChoice[T ~string](label, value string, allowed ...T) (T, error) {
	choice := T(strings.TrimSpace(value))
	if slices.Contains(allowed, choice) {
		return choice, nil
	}
	return "", fmt.Errorf("%s %q is not supported; choose one of %q", label, value, allowed)
}

func ParseHTTPVersion(value string) (HTTPVersion, error) {
	return parseChoice("the HTTP version", value, HTTPVersionAuto, HTTPVersion1, HTTPVersion2)
}

func ParseRPCTransport(value string) (RPCTransport, error) {
	return parseChoice("the gRPC transport", value, TransportGRPC, TransportGRPCWeb, TransportGRPCWebText, TransportConnect)
}

func (v *HTTPVersion) UnmarshalText(text []byte) error {
	parsed, err := ParseHTTPVersion(string(text))
	*v = parsed
	return err
}

func (t *RPCTransport) UnmarshalText(text []byte) error {
	parsed, err := ParseRPCTransport(string(text))
	*t = parsed
	return err
}
