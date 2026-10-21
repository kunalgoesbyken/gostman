package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"sync"

	"github.com/zalando/go-keyring"
)

const (
	keychainService = "Gostman"
	vaultFileName   = "secrets.enc"
	vaultKeyName    = "secrets.key"
	vaultIndexName  = "secrets-index.json"
	vaultKeyBytes   = 32
	privateFile     = 0o600
)

type secretVault struct {
	mu         sync.Mutex
	directory  string
	useKeyring bool
}

var vault = &secretVault{directory: appFolder, useKeyring: true}

func (v *secretVault) path(name string) string {
	return filepath.Join(v.directory, name)
}

func (v *secretVault) get(key string) (string, bool) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if v.useKeyring {
		if value, err := keyring.Get(keychainService, key); err == nil {
			return value, true
		}
	}
	values, err := v.readFile()
	if err != nil {
		return "", false
	}
	value, found := values[key]
	return value, found
}

func (v *secretVault) set(key, value string) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	if v.useKeyring {
		if err := keyring.Set(keychainService, key, value); err == nil {
			return v.dropFromFile(key)
		}
	}
	values, err := v.readFile()
	if err != nil {
		return err
	}
	values[key] = value
	return v.writeFile(values)
}

func (v *secretVault) remove(key string) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	if v.useKeyring {
		_ = keyring.Delete(keychainService, key)
	}
	return v.dropFromFile(key)
}

func (v *secretVault) dropFromFile(key string) error {
	values, err := v.readFile()
	if err != nil {
		return err
	}
	if _, found := values[key]; !found {
		return nil
	}
	delete(values, key)
	return v.writeFile(values)
}

func (v *secretVault) cipher() (cipher.AEAD, error) {
	key, err := os.ReadFile(v.path(vaultKeyName))
	if errors.Is(err, fs.ErrNotExist) {
		key = make([]byte, vaultKeyBytes)
		if _, err := rand.Read(key); err != nil {
			return nil, err
		}
		if err := os.MkdirAll(v.directory, 0o755); err != nil {
			return nil, err
		}
		if err := os.WriteFile(v.path(vaultKeyName), key, privateFile); err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

func (v *secretVault) readFile() (map[string]string, error) {
	values := map[string]string{}
	sealed, err := os.ReadFile(v.path(vaultFileName))
	if errors.Is(err, fs.ErrNotExist) || (err == nil && len(sealed) == 0) {
		return values, nil
	}
	if err != nil {
		return nil, err
	}
	aead, err := v.cipher()
	if err != nil {
		return nil, err
	}
	if len(sealed) < aead.NonceSize() {
		return nil, fmt.Errorf("the secrets file is damaged")
	}
	nonce, body := sealed[:aead.NonceSize()], sealed[aead.NonceSize():]
	plain, err := aead.Open(nil, nonce, body, nil)
	if err != nil {
		return nil, fmt.Errorf("the secrets file cannot be decrypted: %w", err)
	}
	if err := json.Unmarshal(plain, &values); err != nil {
		return nil, err
	}
	return values, nil
}

func (v *secretVault) writeFile(values map[string]string) error {
	plain, err := json.Marshal(values)
	if err != nil {
		return err
	}
	aead, err := v.cipher()
	if err != nil {
		return err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return err
	}
	sealed := aead.Seal(nonce, nonce, plain, nil)
	if err := os.MkdirAll(v.directory, 0o755); err != nil {
		return err
	}
	temporary := v.path(vaultFileName) + ".tmp"
	if err := os.WriteFile(temporary, sealed, privateFile); err != nil {
		return err
	}
	return os.Rename(temporary, v.path(vaultFileName))
}

func (v *secretVault) readIndex() map[string]string {
	index := map[string]string{}
	content, err := os.ReadFile(v.path(vaultIndexName))
	if err == nil {
		_ = json.Unmarshal(content, &index)
	}
	return index
}

func (v *secretVault) writeIndex(index map[string]string) error {
	content, err := json.MarshalIndent(index, "", " ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(v.directory, 0o755); err != nil {
		return err
	}
	return os.WriteFile(v.path(vaultIndexName), content, privateFile)
}

func (v *secretVault) reconcile(scope string, wanted map[string]bool) error {
	v.mu.Lock()
	index := v.readIndex()
	v.mu.Unlock()
	changed := false
	for key, owner := range index {
		if owner == scope && !wanted[key] {
			if err := v.remove(key); err != nil {
				return err
			}
			delete(index, key)
			changed = true
		}
	}
	for key := range wanted {
		if index[key] != scope {
			index[key] = scope
			changed = true
		}
	}
	if !changed {
		return nil
	}
	v.mu.Lock()
	defer v.mu.Unlock()
	return v.writeIndex(index)
}

func secretKey(scope, environmentId, name string) string {
	return url.PathEscape(scope) + "/" + url.PathEscape(environmentId) + "/" + url.PathEscape(name)
}

type secretFlags map[string]struct {
	Secret  bool  `json:"secret,omitempty"`
	Enabled *bool `json:"enabled,omitempty"`
}

func parseMeta(text string) secretFlags {
	flags := secretFlags{}
	if text == "" {
		return flags
	}
	if err := json.Unmarshal([]byte(text), &flags); err != nil {
		return secretFlags{}
	}
	return flags
}

type orderedPair struct {
	name  string
	value json.RawMessage
}

func readPairs(text string) ([]orderedPair, bool) {
	decoder := json.NewDecoder(bytes.NewReader([]byte(text)))
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		return nil, false
	}
	var pairs []orderedPair
	for decoder.More() {
		token, err := decoder.Token()
		if err != nil {
			return nil, false
		}
		name, isName := token.(string)
		var value json.RawMessage
		if !isName || decoder.Decode(&value) != nil {
			return nil, false
		}
		pairs = append(pairs, orderedPair{name, value})
	}
	return pairs, true
}

func writePairs(pairs []orderedPair) string {
	var out bytes.Buffer
	out.WriteByte('{')
	for i, pair := range pairs {
		if i > 0 {
			out.WriteByte(',')
		}
		name, _ := json.Marshal(pair.name)
		out.Write(name)
		out.WriteByte(':')
		out.Write(pair.value)
	}
	out.WriteByte('}')
	var indented bytes.Buffer
	if err := json.Indent(&indented, out.Bytes(), "", "  "); err != nil {
		return out.String()
	}
	return indented.String()
}

func plainString(raw json.RawMessage) string {
	var text string
	if json.Unmarshal(raw, &text) == nil {
		return text
	}
	return string(raw)
}

type secretEntry struct {
	environmentId string
	name          string
	value         string
	known         bool
}

func splitSecrets(environments []Environment) ([]Environment, []secretEntry) {
	stripped := make([]Environment, len(environments))
	var entries []secretEntry
	for i, environment := range environments {
		stripped[i] = environment
		flags := parseMeta(environment.Meta)
		pairs, ok := readPairs(environment.Variables)
		if !ok {
			continue
		}
		kept := make([]orderedPair, 0, len(pairs))
		for _, pair := range pairs {
			if !flags[pair.name].Secret {
				kept = append(kept, pair)
				continue
			}
			entries = append(entries, secretEntry{environmentId: environment.Id, name: pair.name, value: plainString(pair.value), known: true})
		}
		if len(kept) != len(pairs) {
			stripped[i].Variables = writePairs(kept)
		}
		for name, flag := range flags {
			if flag.Secret {
				entries = append(entries, secretEntry{environmentId: environment.Id, name: name})
			}
		}
	}
	return stripped, entries
}

func (v *secretVault) keep(scope string, entries []secretEntry) error {
	wanted := map[string]bool{}
	for _, entry := range entries {
		key := secretKey(scope, entry.environmentId, entry.name)
		wanted[key] = true
		if !entry.known {
			continue
		}
		if err := v.set(key, entry.value); err != nil {
			return fmt.Errorf("secret %q could not be stored: %w", entry.name, err)
		}
	}
	return v.reconcile(scope, wanted)
}

func (v *secretVault) withoutSecrets(environments []Environment, scope string) ([]Environment, error) {
	stripped, entries := splitSecrets(environments)
	if err := v.keep(scope, entries); err != nil {
		return nil, err
	}
	return stripped, nil
}

func (v *secretVault) withSecrets(environments []Environment, scope string) []Environment {
	filled := make([]Environment, len(environments))
	for i, environment := range environments {
		filled[i] = environment
		flags := parseMeta(environment.Meta)
		pairs, ok := readPairs(environment.Variables)
		if !ok {
			pairs = nil
		}
		present := map[string]bool{}
		for _, pair := range pairs {
			present[pair.name] = true
		}
		added := false
		names := make([]string, 0, len(flags))
		for name := range flags {
			names = append(names, name)
		}
		sort.Strings(names)
		for _, name := range names {
			if !flags[name].Secret || present[name] {
				continue
			}
			value, _ := v.get(secretKey(scope, environment.Id, name))
			encoded, _ := json.Marshal(value)
			pairs = append(pairs, orderedPair{name, encoded})
			added = true
		}
		if added {
			filled[i].Variables = writePairs(pairs)
		}
	}
	return filled
}
