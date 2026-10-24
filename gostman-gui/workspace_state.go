package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const (
	workspaceStateFile = "workspaces.json"
	maxRecentFolders   = 8
)

type oauthTokens struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	IDToken      string `json:"idToken,omitempty"`
	ExpiresAt    int64  `json:"expiresAt"`
	Issuer       string `json:"issuer"`
	Environment  string `json:"environment,omitempty"`
}

func issuerOf(request Request) string {
	config := request.Auth.OAuth2
	identity := strings.Join([]string{request.URL, config.TokenURL, config.AuthURL, config.ClientID}, "\n")
	digest := sha256.Sum256([]byte(identity))
	return hex.EncodeToString(digest[:])
}

type workspaceMemory struct {
	Trusted             bool                   `json:"trusted"`
	ActiveEnvironmentId string                 `json:"activeEnvironmentId"`
	Collapsed           []string               `json:"collapsed"`
	Tokens              map[string]oauthTokens `json:"tokens"`
}

type workspaceState struct {
	Current string                     `json:"current"`
	Recent  []string                   `json:"recent"`
	Pinned  []string                   `json:"pinned"`
	Names   map[string]string          `json:"names"`
	Folders map[string]workspaceMemory `json:"folders"`
}

var workspaceStateMutex sync.Mutex

func workspaceStatePath() string {
	return filepath.Join(appFolder, workspaceStateFile)
}

func (m workspaceMemory) withTokens(request Request) Request {
	tokens := m.Tokens[request.Id]
	if tokens.Issuer != issuerOf(request) {
		return request
	}
	request.Auth.OAuth2.AccessToken = tokens.AccessToken
	request.Auth.OAuth2.RefreshToken = tokens.RefreshToken
	request.Auth.OAuth2.IDToken = tokens.IDToken
	request.Auth.OAuth2.ExpiresAt = tokens.ExpiresAt
	request.Auth.OAuth2.TokenEnvironment = tokens.Environment
	return request
}

func (m workspaceMemory) isCollapsed(folderId string) bool {
	for _, id := range m.Collapsed {
		if id == folderId {
			return true
		}
	}
	return false
}

func (m *workspaceMemory) keepTokens(requests []Request) {
	if m.Tokens == nil {
		m.Tokens = map[string]oauthTokens{}
	}
	for _, request := range requests {
		config := request.Auth.OAuth2
		if config.AccessToken == "" && config.RefreshToken == "" {
			delete(m.Tokens, request.Id)
			continue
		}
		m.Tokens[request.Id] = oauthTokens{
			AccessToken:  config.AccessToken,
			RefreshToken: config.RefreshToken,
			IDToken:      config.IDToken,
			ExpiresAt:    config.ExpiresAt,
			Issuer:       issuerOf(request),
			Environment:  config.TokenEnvironment,
		}
	}
}

func (m *workspaceMemory) keepCollapsed(folders []Folder) {
	m.Collapsed = []string{}
	for _, folder := range folders {
		if !folder.IsOpen {
			m.Collapsed = append(m.Collapsed, folder.Id)
		}
	}
}

func (s *workspaceState) memoryOf(path string) workspaceMemory {
	if s.Folders == nil {
		s.Folders = map[string]workspaceMemory{}
	}
	return s.Folders[path]
}

func (s *workspaceState) open(path string) {
	recent := []string{path}
	unpinned := 0
	if !s.isPinned(path) {
		unpinned = 1
	}
	for _, known := range s.Recent {
		if known == path {
			continue
		}
		if s.isPinned(known) {
			recent = append(recent, known)
			continue
		}
		if unpinned < maxRecentFolders {
			recent = append(recent, known)
			unpinned++
		}
	}
	s.Current, s.Recent = path, recent
}

func readWorkspaceStateFile() (workspaceState, error) {
	var state workspaceState
	content, err := os.ReadFile(workspaceStatePath())
	if errors.Is(err, fs.ErrNotExist) || (err == nil && len(content) == 0) {
		return state, nil
	}
	if err != nil {
		return state, fmt.Errorf("failed to read the list of folders: %w", err)
	}
	if err := json.Unmarshal(content, &state); err != nil {
		return state, fmt.Errorf("the list of folders is corrupted: %w", err)
	}
	return state, nil
}

func writeWorkspaceStateFile(state workspaceState) error {
	if err := os.MkdirAll(appFolder, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}
	encoded, err := json.MarshalIndent(state, "", " ")
	if err != nil {
		return fmt.Errorf("failed to encode the list of folders: %w", err)
	}
	temporary := workspaceStatePath() + ".tmp"
	if err := os.WriteFile(temporary, encoded, 0600); err != nil {
		return fmt.Errorf("failed to write the list of folders: %w", err)
	}
	if err := os.Rename(temporary, workspaceStatePath()); err != nil {
		return fmt.Errorf("failed to replace the list of folders: %w", err)
	}
	return nil
}

func readWorkspaceState() (workspaceState, error) {
	workspaceStateMutex.Lock()
	defer workspaceStateMutex.Unlock()
	return readWorkspaceStateFile()
}

func recallWorkspace(path string) (workspaceMemory, error) {
	state, err := readWorkspaceState()
	return state.memoryOf(path), err
}

func mutateWorkspaceState(mutate func(state *workspaceState)) error {
	workspaceStateMutex.Lock()
	defer workspaceStateMutex.Unlock()
	state, err := readWorkspaceStateFile()
	if err != nil {
		return err
	}
	mutate(&state)
	return writeWorkspaceStateFile(state)
}

func clearWorkspaceState() error {
	workspaceStateMutex.Lock()
	defer workspaceStateMutex.Unlock()
	err := os.Remove(workspaceStatePath())
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	return err
}
