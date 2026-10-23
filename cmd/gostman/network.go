package main

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

const everyHost = "*"

type fileList []string

func (f *fileList) String() string {
	return strings.Join(*f, ",")
}

func (f *fileList) Set(path string) error {
	if strings.TrimSpace(path) == "" {
		return errors.New("name a file")
	}
	*f = append(*f, path)
	return nil
}

type certificateFiles struct {
	host string
	cert string
	key  string
}

type clientCertificates struct {
	scoped   []certificateFiles
	unscoped string
}

func (c *clientCertificates) String() string {
	return ""
}

func (c *clientCertificates) Set(value string) error {
	host, files, scoped := strings.Cut(value, "=")
	if !scoped {
		return c.setUnscoped(value)
	}
	cert, key, paired := strings.Cut(files, ",")
	if strings.TrimSpace(host) == "" || !paired || cert == "" || key == "" {
		return errors.New("write it as host=cert.pem,key.pem, or give the certificate file and its key with --client-key")
	}
	c.scoped = append(c.scoped, certificateFiles{host: host, cert: cert, key: key})
	return nil
}

func (c *clientCertificates) setUnscoped(path string) error {
	if strings.TrimSpace(path) == "" {
		return errors.New("name a certificate file")
	}
	if c.unscoped != "" {
		return errors.New("give one certificate for every host; use host=cert.pem,key.pem for others")
	}
	c.unscoped = path
	return nil
}

type networkSettings struct {
	authorities  fileList
	certificates clientCertificates
	key          string
	proxy        string
	bypass       string
}

func networkFlags(flags *flag.FlagSet) *networkSettings {
	settings := &networkSettings{}
	flags.Var(&settings.authorities, "cacert", "")
	flags.Var(&settings.certificates, "client-cert", "")
	flags.StringVar(&settings.key, "client-key", "", "")
	flags.StringVar(&settings.proxy, "proxy", "", "")
	flags.StringVar(&settings.bypass, "noproxy", "", "")
	return settings
}

func (s *networkSettings) isDefault() bool {
	return len(s.authorities) == 0 && len(s.certificates.scoped) == 0 && s.certificates.unscoped == "" && s.key == "" && s.proxy == "" && s.bypass == ""
}

func (s *networkSettings) network() (*engine.Network, error) {
	if s.isDefault() {
		return nil, nil
	}
	if err := s.check(); err != nil {
		return nil, err
	}
	config := engine.NetworkConfig{ProxyMode: engine.ProxySystem}
	if s.proxy != "" {
		config.ProxyMode = engine.ProxyCustom
		config.ProxyURL = s.proxy
		config.ProxyBypass = s.bypass
	}
	authorities, err := readAuthorities(s.authorities)
	if err != nil {
		return nil, err
	}
	config.CAPEM = authorities
	certificates, err := readCertificates(s.allCertificates())
	if err != nil {
		return nil, err
	}
	config.Certificates = certificates
	return engine.NewNetwork(config)
}

func (s *networkSettings) check() error {
	switch {
	case (s.certificates.unscoped == "") != (s.key == ""):
		return errors.New("--client-cert <file> and --client-key <file> go together")
	case s.bypass != "" && s.proxy == "":
		return errors.New("--noproxy lists hosts that skip --proxy; with the HTTPS_PROXY environment variable, use NO_PROXY")
	}
	return nil
}

func (s *networkSettings) allCertificates() []certificateFiles {
	if s.certificates.unscoped == "" {
		return s.certificates.scoped
	}
	return append(s.certificates.scoped, certificateFiles{host: everyHost, cert: s.certificates.unscoped, key: s.key})
}

func readAuthorities(paths []string) (string, error) {
	var bundle strings.Builder
	for _, path := range paths {
		content, err := os.ReadFile(path)
		if err != nil {
			return "", fmt.Errorf("--cacert: %w", err)
		}
		if !x509.NewCertPool().AppendCertsFromPEM(content) {
			return "", fmt.Errorf("--cacert %s holds no PEM certificates", path)
		}
		bundle.Write(content)
		bundle.WriteString("\n")
	}
	return bundle.String(), nil
}

func readCertificates(entries []certificateFiles) ([]engine.ClientCertificate, error) {
	certificates := make([]engine.ClientCertificate, 0, len(entries))
	for _, entry := range entries {
		certificate, err := readCertificate(entry)
		if err != nil {
			return nil, err
		}
		certificates = append(certificates, certificate)
	}
	return certificates, nil
}

func readCertificate(entry certificateFiles) (engine.ClientCertificate, error) {
	cert, err := os.ReadFile(entry.cert)
	if err != nil {
		return engine.ClientCertificate{}, fmt.Errorf("--client-cert: %w", err)
	}
	key, err := os.ReadFile(entry.key)
	if err != nil {
		return engine.ClientCertificate{}, fmt.Errorf("--client-key: %w", err)
	}
	if _, err := tls.X509KeyPair(cert, key); err != nil {
		return engine.ClientCertificate{}, fmt.Errorf("client certificate %s with key %s: %w", entry.cert, entry.key, err)
	}
	return engine.ClientCertificate{Host: entry.host, CertPEM: string(cert), KeyPEM: string(key)}, nil
}
