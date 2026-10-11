package engine

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const (
	ProxySystem = "system"
	ProxyNone   = "none"
	ProxyCustom = "custom"

	noCertificate = -1
)

var proxySchemes = map[string]bool{"http": true, "https": true, "socks5": true, "socks5h": true}

type ClientCertificate struct {
	Host    string `json:"host"`
	CertPEM string `json:"certPem"`
	KeyPEM  string `json:"keyPem"`
}

type NetworkConfig struct {
	ProxyMode    string              `json:"proxyMode"`
	ProxyURL     string              `json:"proxyUrl"`
	ProxyBypass  string              `json:"proxyBypass"`
	Certificates []ClientCertificate `json:"certificates"`
	CAPEM        string              `json:"caPem"`
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
	proxy        func(*http.Request) (*url.URL, error)
	certificates []hostCertificate
	roots        *x509.CertPool

	mu         sync.Mutex
	transports map[transportKey]*http.Transport
}

var defaultNetwork = &Network{proxy: http.ProxyFromEnvironment, transports: map[transportKey]*http.Transport{}}

func NewNetwork(config NetworkConfig) (*Network, error) {
	proxy, err := proxyFor(config)
	if err != nil {
		return nil, err
	}
	roots, err := rootsFor(config.CAPEM)
	if err != nil {
		return nil, err
	}
	network := &Network{proxy: proxy, roots: roots, transports: map[transportKey]*http.Transport{}}
	for _, entry := range config.Certificates {
		host := strings.ToLower(strings.TrimSpace(entry.Host))
		if host == "" {
			return nil, fmt.Errorf("a client certificate has no host")
		}
		certificate, err := tls.X509KeyPair([]byte(entry.CertPEM), []byte(entry.KeyPEM))
		if err != nil {
			return nil, fmt.Errorf("client certificate for %s: %w", host, err)
		}
		network.certificates = append(network.certificates, hostCertificate{host, certificate})
	}
	return network, nil
}

func proxyFor(config NetworkConfig) (func(*http.Request) (*url.URL, error), error) {
	switch config.ProxyMode {
	case ProxyNone:
		return nil, nil
	case ProxyCustom:
		return customProxy(config.ProxyURL, config.ProxyBypass)
	default:
		return http.ProxyFromEnvironment, nil
	}
}

func customProxy(raw, bypass string) (func(*http.Request) (*url.URL, error), error) {
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
	bypassed := splitHosts(bypass)
	return func(request *http.Request) (*url.URL, error) {
		host := strings.ToLower(request.URL.Hostname())
		for _, pattern := range bypassed {
			if hostMatches(pattern, host) {
				return nil, nil
			}
		}
		return proxy, nil
	}, nil
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

func rootsFor(pem string) (*x509.CertPool, error) {
	if strings.TrimSpace(pem) == "" {
		return nil, nil
	}
	roots, err := x509.SystemCertPool()
	if err != nil {
		roots = x509.NewCertPool()
	}
	if !roots.AppendCertsFromPEM([]byte(pem)) {
		return nil, fmt.Errorf("the CA certificate file holds no PEM certificates")
	}
	return roots, nil
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

func (n *Network) transport(key transportKey) *http.Transport {
	n.mu.Lock()
	defer n.mu.Unlock()

	if transport, ok := n.transports[key]; ok {
		return transport
	}
	tlsConfig := &tls.Config{InsecureSkipVerify: key.insecureTLS, RootCAs: n.roots}
	transport := &http.Transport{
		Proxy:                 n.proxy,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   15 * time.Second,
		ExpectContinueTimeout: time.Second,
		TLSClientConfig:       tlsConfig,
	}
	if key.blockPrivate {
		transport.Proxy = nil
		transport.DialContext = guardedDial
	} else if key.certificate != noCertificate {
		tlsConfig.Certificates = []tls.Certificate{n.certificates[key.certificate].certificate}
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
	return r.network.transport(key).RoundTrip(request)
}

func (p Policy) route(insecureTLS bool) route {
	network := p.Network
	if network == nil {
		network = defaultNetwork
	}
	return route{network, p.BlockPrivate, insecureTLS, p.refusal}
}

func (p Policy) Transport(insecureTLS bool) http.RoundTripper {
	return p.route(insecureTLS)
}
