package engine

import (
	"crypto/x509"
	"fmt"
	"strings"
)

type CertificateFiles struct {
	Host       string
	CertFile   string
	KeyFile    string
	Passphrase string
}

type NetworkFiles struct {
	ProxyMode    string
	ProxyURL     string
	ProxyBypass  string
	ProxySource  string
	CAFiles      []string
	Certificates []CertificateFiles
}

func (f NetworkFiles) IsEmpty() bool {
	return f.ProxyMode == "" && strings.TrimSpace(f.ProxyBypass) == "" && len(f.CAFiles) == 0 && len(f.Certificates) == 0
}

func (f NetworkFiles) Read(read FileReader) (NetworkConfig, error) {
	config := NetworkConfig{ProxyMode: f.ProxyMode, ProxyURL: f.ProxyURL, ProxyBypass: f.ProxyBypass, ProxySource: f.ProxySource}
	for _, path := range f.CAFiles {
		authorities, err := readAuthorityFile(read, path)
		if err != nil {
			return NetworkConfig{}, err
		}
		config.Authorities = append(config.Authorities, authorities...)
	}
	for _, files := range f.Certificates {
		certificate, err := files.read(read)
		if err != nil {
			return NetworkConfig{}, fmt.Errorf("client certificate for %s: %w", files.Host, err)
		}
		config.Certificates = append(config.Certificates, certificate)
	}
	return config, nil
}

func readAuthorityFile(read FileReader, path string) ([]*x509.Certificate, error) {
	data, err := read(path)
	if err != nil {
		return nil, fmt.Errorf("CA certificate: %w", err)
	}
	authorities, err := parseAuthorities(data)
	if err != nil {
		return nil, fmt.Errorf("CA certificate %s: %w", path, err)
	}
	return authorities, nil
}

func (f CertificateFiles) read(read FileReader) (ClientCertificate, error) {
	if strings.TrimSpace(f.CertFile) == "" {
		return ClientCertificate{}, fmt.Errorf("choose the certificate file")
	}
	cert, err := read(f.CertFile)
	if err != nil {
		return ClientCertificate{}, err
	}
	var key []byte
	if strings.TrimSpace(f.KeyFile) != "" {
		if key, err = read(f.KeyFile); err != nil {
			return ClientCertificate{}, err
		}
	}
	certificate, err := parseClientCertificate(cert, key, f.Passphrase)
	if err != nil {
		return ClientCertificate{}, fmt.Errorf("%s: %w", f.names(), err)
	}
	return ClientCertificate{Host: f.Host, Certificate: certificate}, nil
}

func (f CertificateFiles) names() string {
	if strings.TrimSpace(f.KeyFile) == "" {
		return f.CertFile
	}
	return f.CertFile + ", " + f.KeyFile
}
