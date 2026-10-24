package workspace

import (
	"fmt"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	networkKey    = "network"
	networkSource = "the network section of " + ManifestName
)

type NetworkCertificate struct {
	Host string `yaml:"host" json:"host"`
	Cert string `yaml:"cert" json:"cert"`
	Key  string `yaml:"key" json:"key"`
}

type Network struct {
	Proxy        string               `yaml:"proxy" json:"proxy"`
	NoProxy      string               `yaml:"noProxy" json:"noProxy"`
	CA           string               `yaml:"ca" json:"ca"`
	Certificates []NetworkCertificate `yaml:"certificates" json:"certificates"`
}

func (w *Workspace) Network() (Network, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	root, err := w.readManifest()
	if err != nil {
		return Network{}, err
	}
	var network Network
	for i := 0; i+1 < len(root.Content); i += 2 {
		if root.Content[i].Value != networkKey {
			continue
		}
		if err := root.Content[i+1].Decode(&network); err != nil {
			return Network{}, fmt.Errorf("%s, network: %w", ManifestName, err)
		}
	}
	return network, nil
}

func (n Network) Files() engine.NetworkFiles {
	files := engine.NetworkFiles{ProxyBypass: n.NoProxy, ProxySource: networkSource}
	switch proxy := strings.TrimSpace(n.Proxy); proxy {
	case "":
	case engine.ProxyNone, engine.ProxySystem:
		files.ProxyMode = proxy
	default:
		files.ProxyMode, files.ProxyURL = engine.ProxyCustom, proxy
	}
	if strings.TrimSpace(n.CA) != "" {
		files.CAFiles = []string{n.CA}
	}
	for _, certificate := range n.Certificates {
		files.Certificates = append(files.Certificates, engine.CertificateFiles{Host: certificate.Host, CertFile: certificate.Cert, KeyFile: certificate.Key})
	}
	return files
}
