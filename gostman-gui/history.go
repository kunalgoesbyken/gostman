package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
)

const (
	historyFileName      = "history.json"
	corruptHistorySuffix = ".corrupt"
	emptyHistory         = "[]"
)

var (
	historyPath  = filepath.Join(appFolder, historyFileName)
	historySplit bool
)

type storedData struct {
	SavedData
	History json.RawMessage `json:"history,omitempty"`
}

func (s storedData) carriesHistory() bool {
	return len(s.History) > 0 && !bytes.Equal(s.History, []byte("null"))
}

func readStored() (storedData, error) {
	var stored storedData
	file, err := os.ReadFile(jsonfilePath)
	if errors.Is(err, fs.ErrNotExist) || (err == nil && len(file) == 0) {
		return stored, nil
	}
	if err != nil {
		return stored, fmt.Errorf("failed to read data file: %w", err)
	}
	if err := json.Unmarshal(file, &stored); err != nil {
		return stored, fmt.Errorf("data file is corrupted: %w", err)
	}
	return stored, nil
}

func readData() (SavedData, error) {
	stored, err := readStored()
	return stored.SavedData, err
}

func readHistoryFile() []byte {
	content, err := os.ReadFile(historyPath)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		log.Printf("the history file could not be read: %v", err)
	}
	return bytes.TrimSpace(content)
}

func setAsideHistoryFile() {
	err := os.Rename(historyPath, historyPath+corruptHistorySuffix)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		log.Printf("the damaged history file was not set aside: %v", err)
	}
}

func loadHistory(stored storedData) []HistoryEntry {
	raw, fromFile := stored.History, !stored.carriesHistory()
	if fromFile {
		raw = readHistoryFile()
	}
	if len(raw) == 0 {
		return nil
	}
	var history []HistoryEntry
	if err := json.Unmarshal(raw, &history); err != nil {
		log.Printf("the history was not loaded: %v", err)
		if fromFile {
			setAsideHistoryFile()
		}
		return nil
	}
	return history
}

func writeAtomic(path, label string, content []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}
	temporary := path + ".tmp"
	if err := os.WriteFile(temporary, content, 0644); err != nil {
		return fmt.Errorf("failed to write %s: %w", label, err)
	}
	if err := os.Rename(temporary, path); err != nil {
		return fmt.Errorf("failed to replace %s: %w", label, err)
	}
	return nil
}

func writeHistoryFile(content []byte) error {
	return writeAtomic(historyPath, "history file", content)
}

func writeStored(stored storedData) error {
	if stored.carriesHistory() {
		if err := writeHistoryFile(stored.History); err != nil {
			return err
		}
	}
	if err := writeData(stored.SavedData); err != nil {
		return err
	}
	historySplit = true
	return nil
}

func migrateHistoryLocked() error {
	stored, err := readStored()
	if err != nil {
		return err
	}
	if !stored.carriesHistory() {
		historySplit = true
		return nil
	}
	return writeStored(stored)
}

func migrateHistory() {
	dataMutex.Lock()
	defer dataMutex.Unlock()
	if err := migrateHistoryLocked(); err != nil {
		log.Printf("the history was not moved to its own file: %v", err)
	}
}

func (a *App) SaveHistory(history []HistoryEntry) error {
	dataMutex.Lock()
	defer dataMutex.Unlock()
	if !historySplit {
		if err := migrateHistoryLocked(); err != nil {
			return err
		}
	}
	if history == nil {
		history = []HistoryEntry{}
	}
	encoded, err := json.Marshal(history)
	if err != nil {
		return fmt.Errorf("failed to encode history: %w", err)
	}
	return writeHistoryFile(encoded)
}

func currentHistoryDocument() json.RawMessage {
	raw := readHistoryFile()
	var history []json.RawMessage
	if json.Unmarshal(raw, &history) != nil || history == nil {
		return json.RawMessage(emptyHistory)
	}
	return raw
}

func withHistory(content []byte) []byte {
	var document map[string]json.RawMessage
	if json.Unmarshal(content, &document) != nil || document == nil {
		return content
	}
	if raw, present := document["history"]; present && !bytes.Equal(raw, []byte("null")) {
		return content
	}
	document["history"] = currentHistoryDocument()
	merged, err := json.Marshal(document)
	if err != nil {
		return content
	}
	return merged
}
