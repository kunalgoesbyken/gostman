package engine

import (
	"bufio"
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"time"

	"golang.org/x/net/proxy"
)

const headerProxyAuthorization = "Proxy-Authorization"

type bufferedConn struct {
	net.Conn
	reader *bufio.Reader
}

func (c bufferedConn) Read(buffer []byte) (int, error) {
	return c.reader.Read(buffer)
}

func proxyScheme(secure bool) string {
	if secure {
		return "https"
	}
	return "http"
}

func (p Policy) Dialer(secure bool) func(ctx context.Context, address string) (net.Conn, error) {
	scheme := proxyScheme(secure)
	return func(ctx context.Context, address string) (net.Conn, error) {
		host, _, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		if err := p.refusal(host); err != nil {
			return nil, err
		}
		if p.BlockPrivate {
			return guardedDial(ctx, "tcp", address)
		}
		via, err := p.network().proxyAddress(scheme, address)
		if err != nil {
			return nil, err
		}
		if via == nil {
			return dialer.DialContext(ctx, "tcp", address)
		}
		return p.network().tunnel(ctx, via, address)
	}
}

func (n *Network) proxyAddress(scheme, address string) (*url.URL, error) {
	if n.proxy == nil {
		return nil, nil
	}
	return n.proxy(&http.Request{URL: &url.URL{Scheme: scheme, Host: address}})
}

func (n *Network) tunnel(ctx context.Context, via *url.URL, address string) (net.Conn, error) {
	if via.Scheme == "socks5" || via.Scheme == "socks5h" {
		return socksDial(ctx, via, address)
	}
	conn, err := n.dialProxy(ctx, via)
	if err != nil {
		return nil, err
	}
	tunneled, err := connect(ctx, conn, via, address)
	if err != nil {
		conn.Close()
		return nil, err
	}
	return tunneled, nil
}

func (n *Network) dialProxy(ctx context.Context, via *url.URL) (net.Conn, error) {
	conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(via.Hostname(), proxyPort(via)))
	if err != nil || via.Scheme != "https" {
		return conn, err
	}
	secured := tls.Client(conn, &tls.Config{ServerName: via.Hostname(), RootCAs: n.roots})
	if err := secured.HandshakeContext(ctx); err != nil {
		conn.Close()
		return nil, err
	}
	return secured, nil
}

func proxyPort(via *url.URL) string {
	if port := via.Port(); port != "" {
		return port
	}
	if via.Scheme == "https" {
		return "443"
	}
	return "80"
}

func connect(ctx context.Context, conn net.Conn, via *url.URL, address string) (net.Conn, error) {
	stop := context.AfterFunc(ctx, func() { conn.SetDeadline(time.Unix(1, 0)) })
	defer stop()
	request := &http.Request{Method: http.MethodConnect, URL: &url.URL{Opaque: address}, Host: address, Header: http.Header{}}
	if via.User != nil {
		password, _ := via.User.Password()
		credentials := base64.StdEncoding.EncodeToString([]byte(via.User.Username() + ":" + password))
		request.Header.Set(headerProxyAuthorization, "Basic "+credentials)
	}
	if err := request.Write(conn); err != nil {
		return nil, err
	}
	reader := bufio.NewReader(conn)
	response, err := http.ReadResponse(reader, request)
	if err != nil {
		return nil, fmt.Errorf("the proxy %s did not answer the tunnel request: %w", via.Host, err)
	}
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("the proxy %s refused the tunnel to %s: %s", via.Host, address, response.Status)
	}
	conn.SetDeadline(time.Time{})
	return bufferedConn{conn, reader}, nil
}

func socksDial(ctx context.Context, via *url.URL, address string) (net.Conn, error) {
	socks, err := proxy.FromURL(via, dialer)
	if err != nil {
		return nil, err
	}
	return socks.(proxy.ContextDialer).DialContext(ctx, "tcp", address)
}
