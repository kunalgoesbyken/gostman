package main

import (
	"encoding/json"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/workspace"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	passphraseScope            = "network"
	collectionPassphrasePrefix = "network:"
)

type CertificateFiles struct {
	Host            string `json:"host"`
	CertFile        string `json:"certFile"`
	KeyFile         string `json:"keyFile"`
	Passphrase      string `json:"passphrase,omitempty"`
	PassphraseSaved bool   `json:"passphraseSaved,omitempty"`
}

type Settings struct {
	ProxyMode    string             `json:"proxyMode"`
	ProxyURL     string             `json:"proxyUrl"`
	ProxyBypass  string             `json:"proxyBypass"`
	Certificates []CertificateFiles `json:"certificates"`
	CAFile       string             `json:"caFile"`
}

type CollectionNetwork struct {
	Proxy        string             `json:"proxy"`
	NoProxy      string             `json:"noProxy"`
	CA           string             `json:"ca"`
	Certificates []CertificateFiles `json:"certificates"`
	Active       bool               `json:"active"`
	Restricted   bool               `json:"restricted"`
	Error        string             `json:"error"`
}

type networkState struct {
	mu       sync.Mutex
	global   engine.NetworkConfig
	layerKey string
	layer    CollectionNetwork
	built    *engine.Network
}

var networks = &networkState{}

func passphraseKey(scope string, files CertificateFiles) string {
	return secretKey(scope, strings.ToLower(strings.TrimSpace(files.Host)), files.CertFile)
}

func withPassphrases(scope string, certificates []CertificateFiles) []CertificateFiles {
	filled := make([]CertificateFiles, len(certificates))
	for i, files := range certificates {
		if files.Passphrase == "" && files.PassphraseSaved {
			files.Passphrase, files.PassphraseSaved = vault.get(passphraseKey(scope, files))
		}
		filled[i] = files
	}
	return filled
}

func withoutPassphrases(certificates []CertificateFiles) []CertificateFiles {
	shown := make([]CertificateFiles, len(certificates))
	for i, files := range certificates {
		files.Passphrase = ""
		shown[i] = files
	}
	return shown
}

func keepPassphrases(settings Settings) (Settings, error) {
	kept := settings
	kept.Certificates = make([]CertificateFiles, len(settings.Certificates))
	wanted := map[string]bool{}
	for i, files := range settings.Certificates {
		key := passphraseKey(passphraseScope, files)
		if files.Passphrase != "" {
			if err := vault.set(key, files.Passphrase); err != nil {
				return Settings{}, err
			}
			files.PassphraseSaved = true
		}
		if files.PassphraseSaved {
			wanted[key] = true
		}
		files.Passphrase = ""
		kept.Certificates[i] = files
	}
	return kept, vault.reconcile(passphraseScope, wanted)
}

func certificateFiles(certificates []CertificateFiles) []engine.CertificateFiles {
	files := make([]engine.CertificateFiles, len(certificates))
	for i, entry := range certificates {
		files[i] = engine.CertificateFiles{Host: entry.Host, CertFile: entry.CertFile, KeyFile: entry.KeyFile, Passphrase: entry.Passphrase}
	}
	return files
}

func globalConfig(settings Settings) (engine.NetworkConfig, error) {
	files := engine.NetworkFiles{
		ProxyMode:    settings.ProxyMode,
		ProxyURL:     settings.ProxyURL,
		ProxyBypass:  settings.ProxyBypass,
		Certificates: certificateFiles(settings.Certificates),
	}
	if settings.CAFile != "" {
		files.CAFiles = []string{settings.CAFile}
	}
	config, err := files.Read(os.ReadFile)
	if err != nil {
		return engine.NetworkConfig{}, err
	}
	_, err = engine.NewNetwork(config)
	return config, err
}

func collectionScope(root string) string {
	return collectionPassphrasePrefix + root
}

func collectionCertificates(root string, network workspace.Network) []CertificateFiles {
	certificates := make([]CertificateFiles, len(network.Certificates))
	for i, entry := range network.Certificates {
		certificates[i] = CertificateFiles{Host: entry.Host, CertFile: entry.Cert, KeyFile: entry.Key, PassphraseSaved: true}
	}
	return withPassphrases(collectionScope(root), certificates)
}

func describeCollection(folder *workspace.Workspace) (string, CollectionNetwork, workspace.Network) {
	if folder == nil {
		return "", CollectionNetwork{}, workspace.Network{}
	}
	network, err := folder.Network()
	memory, _ := recallWorkspace(folder.Root())
	status := CollectionNetwork{Proxy: network.Proxy, NoProxy: network.NoProxy, CA: network.CA, Restricted: !memory.Trusted}
	if err != nil {
		status.Error = err.Error()
	}
	encoded, _ := json.Marshal(network)
	return strings.Join([]string{folder.Root(), string(encoded), status.Error, strconv.FormatBool(memory.Trusted)}, "\n"), status, network
}

func (s *networkState) refresh() {
	folder := openFolder()
	key, status, network := describeCollection(folder)
	if s.built != nil && key == s.layerKey {
		return
	}
	config := s.global
	if folder != nil {
		certificates := collectionCertificates(folder.Root(), network)
		status.Certificates = withoutPassphrases(certificates)
		files := network.Files()
		files.Certificates = certificateFiles(certificates)
		if status.Error == "" && !status.Restricted && !files.IsEmpty() {
			config, status = s.withCollection(folder.Root(), files, status)
		}
	}
	built, err := engine.NewNetwork(config)
	if err != nil {
		status.Active, status.Error = false, err.Error()
		built, _ = engine.NewNetwork(s.global)
	}
	s.layerKey, s.layer, s.built = key, status, built
}

func (s *networkState) withCollection(root string, files engine.NetworkFiles, status CollectionNetwork) (engine.NetworkConfig, CollectionNetwork) {
	layer, err := files.Read(engine.FolderFiles(root))
	if err != nil {
		status.Error = err.Error()
		return s.global, status
	}
	status.Active = true
	return s.global.With(layer), status
}

func (s *networkState) current() (*engine.Network, CollectionNetwork) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.refresh()
	return s.built, s.layer
}

func (s *networkState) useGlobal(config engine.NetworkConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.global, s.built = config, nil
}

func (s *networkState) forget() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.built = nil
}

func (a *App) loadNetwork() {
	dataMutex.RLock()
	data, err := readData()
	dataMutex.RUnlock()
	if err != nil {
		return
	}
	settings := data.Settings
	settings.Certificates = withPassphrases(passphraseScope, settings.Certificates)
	config, err := globalConfig(settings)
	if err != nil {
		log.Printf("network settings were not applied: %v", err)
		return
	}
	networks.useGlobal(config)
}

func (a *App) policy() engine.Policy {
	network, _ := networks.current()
	return engine.Policy{Network: network, RevealSecrets: true}
}

func (a *App) sendPolicy() engine.Policy {
	policy := a.policy()
	policy.ReadFile = workspaceFiles()
	policy.OpenFile = workspaceAttachments()
	return policy
}

func (a *App) SaveSettings(settings Settings) error {
	filled := settings
	filled.Certificates = withPassphrases(passphraseScope, settings.Certificates)
	config, err := globalConfig(filled)
	if err != nil {
		return err
	}
	kept, err := keepPassphrases(filled)
	if err != nil {
		return err
	}
	if err := mutateData(func(data *SavedData) { data.Settings = kept }); err != nil {
		return err
	}
	networks.useGlobal(config)
	return nil
}

func (a *App) CollectionNetwork() CollectionNetwork {
	_, status := networks.current()
	return status
}

func (a *App) SaveCollectionPassphrase(host, certFile, passphrase string) error {
	folder := openFolder()
	if folder == nil {
		return nil
	}
	scope := collectionScope(folder.Root())
	network, err := folder.Network()
	if err != nil {
		return err
	}
	wanted := map[string]bool{}
	for _, files := range collectionCertificates(folder.Root(), network) {
		if files.PassphraseSaved {
			wanted[passphraseKey(scope, files)] = true
		}
	}
	key := passphraseKey(scope, CertificateFiles{Host: host, CertFile: certFile})
	delete(wanted, key)
	if passphrase != "" {
		if err := vault.set(key, passphrase); err != nil {
			return err
		}
		wanted[key] = true
	}
	defer networks.forget()
	return vault.reconcile(scope, wanted)
}

func (a *App) PickFile(title string) (string, error) {
	return wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{Title: title})
}

func (a *App) SaveCookies(cookies []engine.CookieInfo) error {
	return mutateData(func(data *SavedData) {
		data.Cookies = cookies
	})
}
