package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const everyHost = "*"

var (
	cliAdvice = engine.Advice{
		UntrustedAuthority: "Pass the file of its certificate authority with --cacert, or skip verification with --insecure.",
		ClientCertificate:  "If the server requires a client certificate, pass it with --client-cert.",
	}
	relayAdvice = engine.Advice{
		UntrustedAuthority: "Restart gostman relay with --cacert and the file of its certificate authority, or turn off certificate verification for this request.",
		ClientCertificate:  "If the server requires a client certificate, restart gostman relay with --client-cert.",
	}
)

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
	if strings.TrimSpace(host) == "" || cert == "" || (paired && key == "") {
		return errors.New("write it as host=cert.pem,key.pem or host=cert.p12, or give the certificate file and its key with --client-key")
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
	authorities   fileList
	certificates  clientCertificates
	key           string
	passphraseEnv string
	proxy         string
	bypass        string
	advice        engine.Advice
}

func networkFlags(flags *flag.FlagSet) *networkSettings {
	settings := &networkSettings{advice: cliAdvice}
	flags.Var(&settings.authorities, "cacert", "")
	flags.Var(&settings.certificates, "client-cert", "")
	flags.StringVar(&settings.key, "client-key", "", "")
	flags.StringVar(&settings.passphraseEnv, "client-cert-pass-env", "", "")
	flags.StringVar(&settings.proxy, "proxy", "", "")
	flags.StringVar(&settings.bypass, "noproxy", "", "")
	return settings
}

func (s *networkSettings) check() error {
	switch {
	case s.certificates.unscoped == "" && s.key != "":
		return errors.New("--client-key <file> belongs to --client-cert <file>")
	case s.bypass != "" && s.proxy == "":
		return errors.New("--noproxy lists hosts that skip --proxy; with the HTTPS_PROXY environment variable, use NO_PROXY")
	}
	return nil
}

func (s *networkSettings) passphrase() (string, error) {
	if s.passphraseEnv == "" {
		return "", nil
	}
	value, found := os.LookupEnv(s.passphraseEnv)
	if !found {
		return "", fmt.Errorf("--client-cert-pass-env names %s, which is not set", s.passphraseEnv)
	}
	return value, nil
}

func (s *networkSettings) files() engine.NetworkFiles {
	files := engine.NetworkFiles{CAFiles: s.authorities}
	if s.proxy != "" {
		files.ProxyMode, files.ProxyURL, files.ProxyBypass, files.ProxySource = engine.ProxyCustom, s.proxy, s.bypass, "the --proxy flag"
	}
	for _, entry := range s.allCertificates() {
		files.Certificates = append(files.Certificates, engine.CertificateFiles{Host: entry.host, CertFile: entry.cert, KeyFile: entry.key})
	}
	return files
}

func (s *networkSettings) allCertificates() []certificateFiles {
	if s.certificates.unscoped == "" {
		return s.certificates.scoped
	}
	return append(s.certificates.scoped, certificateFiles{host: everyHost, cert: s.certificates.unscoped, key: s.key})
}

func withPassphrase(files engine.NetworkFiles, passphrase string) engine.NetworkFiles {
	certificates := make([]engine.CertificateFiles, len(files.Certificates))
	for i, entry := range files.Certificates {
		entry.Passphrase = passphrase
		certificates[i] = entry
	}
	files.Certificates = certificates
	return files
}

func withPassphraseHint(err error) error {
	if errors.Is(err, engine.ErrPassphraseNeeded) {
		return fmt.Errorf("%w: put it in an environment variable and pass the variable's name with --client-cert-pass-env", err)
	}
	return err
}

func (s *networkSettings) network(stored runner.Collection) (*engine.Network, error) {
	given, collected := s.files(), stored.Network
	passphrase, err := s.passphrase()
	if err != nil {
		return nil, err
	}
	layer, err := withPassphrase(collected, passphrase).Read(engine.FolderFiles(stored.Root))
	if err != nil {
		return nil, fmt.Errorf("%s network: %w", workspace.ManifestName, withPassphraseHint(err))
	}
	flagged, err := withPassphrase(given, passphrase).Read(os.ReadFile)
	if err != nil {
		return nil, withPassphraseHint(err)
	}
	return engine.NewNetwork(engine.NetworkConfig{ProxyMode: engine.ProxySystem, Advice: s.advice}.With(layer).With(flagged))
}
