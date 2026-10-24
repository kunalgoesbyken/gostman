package main

import (
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type CertificateFiles struct {
	Host     string `json:"host"`
	CertFile string `json:"certFile"`
	KeyFile  string `json:"keyFile"`
}

type Settings struct {
	ProxyMode    string             `json:"proxyMode"`
	ProxyURL     string             `json:"proxyUrl"`
	ProxyBypass  string             `json:"proxyBypass"`
	Certificates []CertificateFiles `json:"certificates"`
	CAFile       string             `json:"caFile"`
}

func readPEM(path string) (string, error) {
	if strings.TrimSpace(path) == "" {
		return "", fmt.Errorf("choose a file")
	}
	content, err := os.ReadFile(path)
	return string(content), err
}

func buildNetwork(settings Settings) (*engine.Network, error) {
	config := engine.NetworkConfig{
		ProxyMode:   settings.ProxyMode,
		ProxyURL:    settings.ProxyURL,
		ProxyBypass: settings.ProxyBypass,
	}
	if settings.CAFile != "" {
		pem, err := readPEM(settings.CAFile)
		if err != nil {
			return nil, fmt.Errorf("CA certificate: %w", err)
		}
		config.CAPEM = pem
	}
	for _, files := range settings.Certificates {
		certificate, err := readPEM(files.CertFile)
		if err != nil {
			return nil, fmt.Errorf("certificate for %s: %w", files.Host, err)
		}
		key, err := readPEM(files.KeyFile)
		if err != nil {
			return nil, fmt.Errorf("key for %s: %w", files.Host, err)
		}
		config.Certificates = append(config.Certificates, engine.ClientCertificate{Host: files.Host, CertPEM: certificate, KeyPEM: key})
	}
	return engine.NewNetwork(config)
}

func (a *App) loadNetwork() {
	dataMutex.RLock()
	data, err := readData()
	dataMutex.RUnlock()
	if err != nil {
		return
	}
	network, err := buildNetwork(data.Settings)
	if err != nil {
		log.Printf("network settings were not applied: %v", err)
		return
	}
	a.setNetwork(network)
}

func (a *App) setNetwork(network *engine.Network) {
	a.networkMu.Lock()
	defer a.networkMu.Unlock()
	a.network = network
}

func (a *App) policy() engine.Policy {
	a.networkMu.RLock()
	defer a.networkMu.RUnlock()
	return engine.Policy{Network: a.network, RevealSecrets: true}
}

func (a *App) sendPolicy() engine.Policy {
	policy := a.policy()
	policy.ReadFile = workspaceFiles()
	return policy
}

func (a *App) SaveSettings(settings Settings) error {
	network, err := buildNetwork(settings)
	if err != nil {
		return err
	}
	if err := mutateData(func(data *SavedData) { data.Settings = settings }); err != nil {
		return err
	}
	a.setNetwork(network)
	return nil
}

func (a *App) PickFile(title string) (string, error) {
	return wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{Title: title})
}

func (a *App) SaveCookies(cookies []engine.CookieInfo) error {
	return mutateData(func(data *SavedData) {
		data.Cookies = cookies
	})
}
