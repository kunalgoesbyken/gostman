package engine

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"sync"
	"time"
)

const (
	ProxySystem = "system"
	ProxyNone   = "none"
	ProxyCustom = "custom"

	noCertificate = -1

	idleConnections        = 512
	idleConnectionsPerHost = 512
)

var proxySchemes = map[string]bool{"http": true, "https": true, "socks5": true, "socks5h": true}

type proxyFunc func(*http.Request) (*url.URL, error)

type ClientCertificate struct {
	Host        string
	Certificate tls.Certificate
}

type NetworkConfig struct {
	ProxyMode    string
	ProxyURL     string
	ProxyBypass  string
	ProxySource  string
	Authorities  []*x509.Certificate
	Certificates []ClientCertificate
	Advice       Advice
}

type hostCertificate struct {
	host        string
	certificate tls.Certificate
}

type transportKey struct {
	blockPrivate bool
	insecureTLS  bool
	certificate  int
}

type Network struct {
	proxy        proxyFunc
	proxySource  string
	certificates []hostCertificate
	roots        *x509.CertPool
	advice       Advice

	mu         sync.Mutex
	transports map[transportKey]*http.Transport
}

const environmentProxySource = "the HTTPS_PROXY and HTTP_PROXY environment variables"

var defaultNetwork = &Network{proxy: http.ProxyFromEnvironment, proxySource: environmentProxySource, transports: map[transportKey]*http.Transport{}}

func (c NetworkConfig) With(layer NetworkConfig) NetworkConfig {
	if layer.ProxyMode != "" {
		c.ProxyMode, c.ProxyURL, c.ProxyBypass, c.ProxySource = layer.ProxyMode, layer.ProxyURL, layer.ProxyBypass, layer.ProxySource
	} else if strings.TrimSpace(layer.ProxyBypass) != "" {
		c.ProxyBypass = strings.Join([]string{c.ProxyBypass, layer.ProxyBypass}, ",")
	}
	c.Authorities = append(slices.Clip(c.Authorities), layer.Authorities...)
	c.Certificates = append(slices.Clip(layer.Certificates), c.Certificates...)
	return c
}

func NewNetwork(config NetworkConfig) (*Network, error) {
	proxy, err := proxyFor(config)
	if err != nil {
		return nil, err
	}
	network := &Network{proxy: proxy, proxySource: proxySourceFor(config), roots: rootsFor(config.Authorities), advice: config.Advice, transports: map[transportKey]*http.Transport{}}
	for _, entry := range config.Certificates {
		host := strings.ToLower(strings.TrimSpace(entry.Host))
		if host == "" {
			return nil, fmt.Errorf("a client certificate has no host")
		}
		network.certificates = append(network.certificates, hostCertificate{host, entry.Certificate})
	}
	return network, nil
}

func proxySourceFor(config NetworkConfig) string {
	if config.ProxySource == "" && config.ProxyMode != ProxyNone && config.ProxyMode != ProxyCustom {
		return environmentProxySource
	}
	return config.ProxySource
}

func proxyFor(config NetworkConfig) (proxyFunc, error) {
	switch config.ProxyMode {
	case ProxyNone:
		return nil, nil
	case ProxyCustom:
		proxy, err := fixedProxy(config.ProxyURL)
		if err != nil {
			return nil, err
		}
		return bypassing(proxy, splitHosts(config.ProxyBypass)), nil
	default:
		return bypassing(http.ProxyFromEnvironment, splitHosts(config.ProxyBypass)), nil
	}
}

func fixedProxy(raw string) (proxyFunc, error) {
	address := strings.TrimSpace(raw)
	if !strings.Contains(address, "://") {
		address = "http://" + address
	}
	proxy, err := url.Parse(address)
	if err != nil || proxy.Host == "" {
		return nil, fmt.Errorf("%q is not a valid proxy address", raw)
	}
	if !proxySchemes[proxy.Scheme] {
		return nil, fmt.Errorf("unsupported proxy scheme %q, use http, https or socks5", proxy.Scheme)
	}
	return http.ProxyURL(proxy), nil
}

func bypassing(proxy proxyFunc, bypassed []string) proxyFunc {
	if len(bypassed) == 0 {
		return proxy
	}
	return func(request *http.Request) (*url.URL, error) {
		host := strings.ToLower(request.URL.Hostname())
		for _, pattern := range bypassed {
			if hostMatches(pattern, host) {
				return nil, nil
			}
		}
		return proxy(request)
	}
}

func splitHosts(list string) []string {
	var hosts []string
	for _, entry := range strings.Split(list, ",") {
		if host := strings.ToLower(strings.TrimSpace(entry)); host != "" {
			hosts = append(hosts, host)
		}
	}
	return hosts
}

func hostMatches(pattern, host string) bool {
	if suffix, isWildcard := strings.CutPrefix(pattern, "*"); isWildcard {
		return strings.HasSuffix(host, suffix)
	}
	return pattern == host
}

func rootsFor(authorities []*x509.Certificate) *x509.CertPool {
	if len(authorities) == 0 {
		return nil
	}
	roots, err := x509.SystemCertPool()
	if err != nil {
		roots = x509.NewCertPool()
	}
	for _, authority := range authorities {
		roots.AddCert(authority)
	}
	return roots
}

func (n *Network) certificateFor(host string) int {
	host = strings.ToLower(host)
	for index, entry := range n.certificates {
		if hostMatches(entry.host, host) {
			return index
		}
	}
	return noCertificate
}

func (n *Network) tlsConfig(key transportKey) *tls.Config {
	config := &tls.Config{InsecureSkipVerify: key.insecureTLS, RootCAs: n.roots}
	if !key.blockPrivate && key.certificate != noCertificate {
		config.Certificates = []tls.Certificate{n.certificates[key.certificate].certificate}
	}
	return config
}

func (n *Network) transport(key transportKey) *http.Transport {
	n.mu.Lock()
	defer n.mu.Unlock()

	if transport, ok := n.transports[key]; ok {
		return transport
	}
	transport := &http.Transport{
		Proxy:                 n.proxy,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          idleConnections,
		MaxIdleConnsPerHost:   idleConnectionsPerHost,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   15 * time.Second,
		ExpectContinueTimeout: time.Second,
		TLSClientConfig:       n.tlsConfig(key),
	}
	if key.blockPrivate {
		transport.Proxy = nil
		transport.DialContext = guardedDial
	}
	n.transports[key] = transport
	return transport
}

type route struct {
	network      *Network
	blockPrivate bool
	insecureTLS  bool
	refusal      func(host string) error
}

func (r route) RoundTrip(request *http.Request) (*http.Response, error) {
	if err := r.refusal(request.URL.Hostname()); err != nil {
		return nil, err
	}
	key := transportKey{r.blockPrivate, r.insecureTLS, r.network.certificateFor(request.URL.Hostname())}
	response, err := r.network.transport(key).RoundTrip(request)
	if err == nil {
		return response, nil
	}
	err = &advisedError{advice: r.network.advice, hasCertificate: key.certificate != noCertificate, err: err}
	if r.network.proxySource != "" {
		return nil, &proxySourceError{r.network.proxySource, err}
	}
	return nil, err
}

type proxySourceError struct {
	source string
	err    error
}

func (e *proxySourceError) Error() string {
	return e.err.Error()
}

func (e *proxySourceError) Unwrap() error {
	return e.err
}

func (p Policy) network() *Network {
	if p.Network == nil {
		return defaultNetwork
	}
	return p.Network
}

func (p Policy) route(insecureTLS bool) route {
	return route{p.network(), p.BlockPrivate, insecureTLS, p.refusal}
}

func (p Policy) Transport(insecureTLS bool) http.RoundTripper {
	return p.route(insecureTLS)
}

func (p Policy) TLSConfig(host string, insecureTLS bool) *tls.Config {
	network := p.network()
	return network.tlsConfig(transportKey{p.BlockPrivate, insecureTLS, network.certificateFor(host)})
}
