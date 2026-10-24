package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/kunalgoesbyken/gostman/secrets"
)

const (
	connectionsFileName   = "secret-connections.json"
	connectionSecretScope = "connections"
	restrictedReferences  = "This folder is not trusted yet, so secret manager references are not resolved. Open the folder menu in the header and choose Trust this folder."
)

type SecretConnection struct {
	Alias  string            `json:"alias"`
	Kind   string            `json:"kind"`
	Values map[string]string `json:"values"`
	Stored []string          `json:"stored,omitempty"`
}

type connectionBook struct {
	mu   sync.Mutex
	path string
}

type connectionRecord struct {
	Kind   string            `json:"kind"`
	Values map[string]string `json:"values"`
}

var (
	connections    = &connectionBook{path: filepath.Join(appFolder, connectionsFileName)}
	secretResolver = secrets.NewResolver(lookupConnection)
)

func (b *connectionBook) read() (map[string]connectionRecord, error) {
	records := map[string]connectionRecord{}
	content, err := os.ReadFile(b.path)
	if errors.Is(err, fs.ErrNotExist) || (err == nil && len(content) == 0) {
		return records, nil
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(content, &records); err != nil {
		return nil, fmt.Errorf("the secret manager connections file is damaged: %w", err)
	}
	return records, nil
}

func (b *connectionBook) write(records map[string]connectionRecord) error {
	content, err := json.MarshalIndent(records, "", " ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(appFolder, 0o755); err != nil {
		return err
	}
	return os.WriteFile(b.path, content, privateFile)
}

func credentialKey(alias, field string) string {
	return secretKey(connectionSecretScope, alias, field)
}

func storedCredentials(alias string, record connectionRecord) map[string]string {
	stored := map[string]string{}
	for field := range secrets.SecretFields(record.Kind) {
		if value, found := vault.get(credentialKey(alias, field)); found {
			stored[field] = value
		}
	}
	return stored
}

func lookupConnection(alias string) (secrets.Connection, error) {
	connections.mu.Lock()
	records, err := connections.read()
	connections.mu.Unlock()
	if err != nil {
		return secrets.Connection{}, err
	}
	record, found := records[alias]
	if !found {
		return secrets.Connection{}, fmt.Errorf("there is no secret manager connection named %q; add it under Secret managers", alias)
	}
	values := maps.Clone(record.Values)
	maps.Copy(values, storedCredentials(alias, record))
	return secrets.Connection{Alias: alias, Kind: record.Kind, Values: values}, nil
}

func (a *App) SecretKinds() []secrets.KindInfo {
	return secrets.Kinds()
}

func (a *App) PairSecretConnection(kind string) (map[string]string, error) {
	return secrets.Pair(a.ctx, kind)
}

func (a *App) UnlockSecretConnection(connection SecretConnection, password string) (map[string]string, error) {
	return secrets.Unlock(a.ctx, secrets.Connection{Alias: connection.Alias, Kind: connection.Kind, Values: connection.Values}, password)
}

func (a *App) SecretConnections() ([]SecretConnection, error) {
	connections.mu.Lock()
	records, err := connections.read()
	connections.mu.Unlock()
	if err != nil {
		return nil, err
	}
	listed := make([]SecretConnection, 0, len(records))
	for _, alias := range slices.Sorted(maps.Keys(records)) {
		record := records[alias]
		stored := slices.Sorted(maps.Keys(storedCredentials(alias, record)))
		listed = append(listed, SecretConnection{Alias: alias, Kind: record.Kind, Values: record.Values, Stored: stored})
	}
	return listed, nil
}

func splitConnection(connection SecretConnection) (connectionRecord, map[string]string) {
	secretFields := secrets.SecretFields(connection.Kind)
	record := connectionRecord{Kind: connection.Kind, Values: map[string]string{}}
	entered := map[string]string{}
	for field, value := range connection.Values {
		switch {
		case secretFields[field] && strings.TrimSpace(value) != "":
			entered[field] = strings.TrimSpace(value)
		case !secretFields[field] && strings.TrimSpace(value) != "":
			record.Values[field] = strings.TrimSpace(value)
		}
	}
	return record, entered
}

func (a *App) SaveSecretConnection(connection SecretConnection) error {
	connection.Alias = strings.TrimSpace(connection.Alias)
	connections.mu.Lock()
	defer connections.mu.Unlock()
	records, err := connections.read()
	if err != nil {
		return err
	}
	existing, isEdit := records[connection.Alias]
	if isEdit && existing.Kind != connection.Kind {
		return fmt.Errorf("connection %q is a %s connection; delete it to create one of another kind", connection.Alias, existing.Kind)
	}
	record, entered := splitConnection(connection)
	merged := storedCredentials(connection.Alias, record)
	maps.Copy(merged, entered)
	maps.Copy(merged, record.Values)
	if err := secrets.Validate(secrets.Connection{Alias: connection.Alias, Kind: connection.Kind, Values: merged}); err != nil {
		return err
	}
	for field, value := range entered {
		if err := vault.set(credentialKey(connection.Alias, field), value); err != nil {
			return fmt.Errorf("the %s could not be stored: %w", field, err)
		}
	}
	records[connection.Alias] = record
	return connections.write(records)
}

func (a *App) DeleteSecretConnection(alias string) error {
	connections.mu.Lock()
	defer connections.mu.Unlock()
	records, err := connections.read()
	if err != nil {
		return err
	}
	record, found := records[alias]
	if !found {
		return nil
	}
	for field := range secrets.SecretFields(record.Kind) {
		if err := vault.remove(credentialKey(alias, field)); err != nil {
			return err
		}
	}
	delete(records, alias)
	return connections.write(records)
}

func workspaceIsRestricted() bool {
	folder, isFolder := storage.current().(folderStore)
	if !isFolder {
		return false
	}
	memory, err := recallWorkspace(folder.folder.Root())
	return err != nil || !memory.Trusted
}

func (a *App) resolveReference(reference secrets.Ref) (string, error) {
	if workspaceIsRestricted() {
		return "", errors.New(restrictedReferences)
	}
	return secretResolver.Resolve(a.ctx, reference)
}

func (a *App) ResolveSecretReferences(references map[string]secrets.Ref) (map[string]string, error) {
	resolved := make(map[string]string, len(references))
	for _, name := range slices.Sorted(maps.Keys(references)) {
		value, err := a.resolveReference(references[name])
		if err != nil {
			return nil, fmt.Errorf("variable %q: %w", name, err)
		}
		resolved[name] = value
	}
	return resolved, nil
}

func (a *App) TestSecretReference(reference secrets.Ref) (int, error) {
	value, err := a.resolveReference(reference)
	return utf8.RuneCountInString(value), err
}
