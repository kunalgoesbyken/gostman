package rpc

import (
	"context"
	"crypto/tls"
	"fmt"
	"math"
	"net"
	"net/url"
	"strings"
	"sync"

	"github.com/krockxz/gostman/engine"
	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
)

const (
	schemePlain = "grpc"
	schemeTLS   = "grpcs"

	defaultPlainPort = "80"
	defaultTLSPort   = "443"
)

type endpoint struct {
	address   string
	authority string
	secure    bool
}

func parseEndpoint(raw string) (endpoint, error) {
	address := strings.TrimSpace(raw)
	if address == "" {
		return endpoint{}, configError("enter a gRPC address such as grpc://localhost:50051")
	}
	parsed, err := url.Parse(address)
	if err != nil || parsed.Hostname() == "" {
		return endpoint{}, configError("%q is not a gRPC address, use grpc://host:port or grpcs://host:port", address)
	}
	if parsed.Scheme != schemePlain && parsed.Scheme != schemeTLS {
		return endpoint{}, configError("unsupported scheme %q, use grpc:// for plaintext or grpcs:// for TLS", parsed.Scheme)
	}

	secure := parsed.Scheme == schemeTLS
	port := parsed.Port()
	if port == "" && secure {
		port = defaultTLSPort
	}
	if port == "" {
		port = defaultPlainPort
	}
	return endpoint{address: address, authority: net.JoinHostPort(parsed.Hostname(), port), secure: secure}, nil
}

type dialFailure struct {
	mu  sync.Mutex
	err error
}

func (f *dialFailure) record(err error) {
	if err == nil {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.err = err
}

func (f *dialFailure) last() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.err
}

type recordedCredentials struct {
	credentials.TransportCredentials
	failure *dialFailure
}

func (c recordedCredentials) ClientHandshake(ctx context.Context, authority string, raw net.Conn) (net.Conn, credentials.AuthInfo, error) {
	conn, info, err := c.TransportCredentials.ClientHandshake(ctx, authority, raw)
	c.failure.record(err)
	return conn, info, err
}

func (c recordedCredentials) Clone() credentials.TransportCredentials {
	return recordedCredentials{c.TransportCredentials.Clone(), c.failure}
}

type connection struct {
	*grpc.ClientConn
	target  endpoint
	failure *dialFailure
}

func dial(target endpoint, options engine.Options, policy engine.Policy) (*connection, error) {
	failure := &dialFailure{}
	dialContext := engine.DialContext(policy)

	client, err := grpc.NewClient(
		"passthrough:///"+target.authority,
		grpc.WithTransportCredentials(transportCredentials(target, options, failure)),
		grpc.WithContextDialer(func(ctx context.Context, address string) (net.Conn, error) {
			conn, err := dialContext(ctx, "tcp", address)
			failure.record(err)
			return conn, err
		}),
		grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(messageLimit(policy))),
		grpc.WithDisableServiceConfig(),
	)
	if err != nil {
		return nil, configError("%q cannot be used as a gRPC address: %v", target.address, err)
	}
	return &connection{ClientConn: client, target: target, failure: failure}, nil
}

func transportCredentials(target endpoint, options engine.Options, failure *dialFailure) credentials.TransportCredentials {
	if !target.secure {
		return insecure.NewCredentials()
	}
	secured := credentials.NewTLS(&tls.Config{InsecureSkipVerify: options.InsecureTLS})
	return recordedCredentials{secured, failure}
}

func messageLimit(policy engine.Policy) int {
	return int(min(policy.ResponseLimit(), math.MaxInt32))
}

func (c *connection) ready(ctx context.Context) error {
	c.Connect()
	for {
		state := c.GetState()
		if state == connectivity.Ready {
			return nil
		}
		if state == connectivity.TransientFailure || state == connectivity.Shutdown {
			return c.connectError()
		}
		if !c.WaitForStateChange(ctx, state) {
			return ctx.Err()
		}
	}
}

func (c *connection) connectError() error {
	if err := c.failure.last(); err != nil {
		return err
	}
	if c.target.secure {
		return fmt.Errorf("%s did not complete the HTTP/2 handshake", c.target.authority)
	}
	return fmt.Errorf("%s did not complete the HTTP/2 handshake; if it expects TLS, use grpcs://", c.target.authority)
}
