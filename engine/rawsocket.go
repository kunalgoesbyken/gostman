package engine

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"unicode"
)

const (
	MethodTCP = "TCP"
	MethodUDP = "UDP"
	BodyHex   = "hex"

	rawStatusReceived = "Received"
	rawReadChunk      = 32 << 10
	rawOKStatus       = 200
)

var errRawSocketsRefused = errors.New("raw TCP, UDP and NATS requests are only sent by the desktop app, in a folder you trust")

func IsRawMethod(method string) bool {
	method = strings.ToUpper(strings.TrimSpace(method))
	return method == MethodTCP || method == MethodUDP || method == MethodNATS
}

type rawTarget struct {
	network string
	address string
	payload []byte
}

func sendRaw(ctx context.Context, r Request, policy Policy) Response {
	if !policy.RawSockets {
		return Failure(ErrorConfig, errRawSocketsRefused.Error())
	}
	ctx, cancel := context.WithTimeout(ctx, policy.Timeout(r.Options))
	defer cancel()
	if strings.EqualFold(strings.TrimSpace(r.Method), MethodNATS) {
		return sendNATS(ctx, r, policy)
	}
	target, err := newRawTarget(r)
	if err != nil {
		return Failure(ErrorConfig, err.Error())
	}
	conn, release, err := openRaw(ctx, target.network, target.address, policy)
	if err != nil {
		return classify(ctx, err)
	}
	defer release()
	return exchangeRaw(ctx, conn, target, policy.ResponseLimit())
}

func openRaw(ctx context.Context, network, address string, policy Policy) (net.Conn, func(), error) {
	host, _, _ := net.SplitHostPort(address)
	if err := policy.refusal(host); err != nil {
		return nil, nil, err
	}
	conn, err := policy.network().dialFunc(policy.BlockPrivate)(ctx, network, address)
	if err != nil {
		return nil, nil, err
	}
	stop := context.AfterFunc(ctx, func() { conn.Close() })
	return conn, func() { stop(); conn.Close() }, nil
}

func newRawTarget(r Request) (rawTarget, error) {
	expansion, err := newSubstitution(r.Variables)
	if err != nil {
		return rawTarget{}, err
	}
	network := strings.ToLower(strings.TrimSpace(r.Method))
	address, err := rawAddress(expansion.apply(r.URL), network)
	if err != nil {
		return rawTarget{}, err
	}
	payload, err := rawPayload(expansion.apply(r.Body), r.BodyType)
	if err != nil {
		return rawTarget{}, err
	}
	if err := expansion.failure(); err != nil {
		return rawTarget{}, err
	}
	return rawTarget{network: network, address: address, payload: payload}, nil
}

func rawAddress(text, network string) (string, error) {
	address := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(text), network+"://"))
	if _, port, err := net.SplitHostPort(address); err != nil || port == "" {
		return "", fmt.Errorf("write the address as host:port, for example %s://localhost:9000", network)
	}
	return address, nil
}

func rawPayload(text, bodyType string) ([]byte, error) {
	if bodyType != BodyHex {
		return []byte(text), nil
	}
	digits := strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			return -1
		}
		return r
	}, text)
	payload, err := hex.DecodeString(digits)
	if err != nil {
		return nil, fmt.Errorf("the hex body is not valid: %w", err)
	}
	return payload, nil
}

func exchangeRaw(ctx context.Context, conn net.Conn, target rawTarget, limit int64) Response {
	if len(target.payload) > 0 {
		if _, err := conn.Write(target.payload); err != nil {
			return classify(ctx, err)
		}
	}
	received, truncated, err := readRaw(conn, target.network, limit)
	if err != nil && ctx.Err() == nil {
		return classify(ctx, err)
	}
	return receivedResponse(rawStatusReceived, strings.ToLower(target.network)+"://"+target.address, received, truncated)
}

func receivedResponse(status, address string, received []byte, truncated bool) Response {
	response := Response{
		Status:     fmt.Sprintf("%s %d bytes", status, len(received)),
		StatusCode: rawOKStatus,
		URL:        address,
		Size:       int64(len(received)),
		Truncated:  truncated,
	}
	response.Body, response.BodyEncoding = EncodeBody(received, truncated)
	response.ContentType = MediaType("", received)
	return response
}

func readRaw(conn net.Conn, network string, limit int64) ([]byte, bool, error) {
	var received []byte
	buffer := make([]byte, rawReadChunk)
	for int64(len(received)) <= limit {
		count, err := conn.Read(buffer)
		received = append(received, buffer[:count]...)
		if err == io.EOF {
			return received, false, nil
		}
		if err != nil {
			return received, false, err
		}
		if network == "udp" {
			return received, false, nil
		}
	}
	return received[:limit], true, nil
}
