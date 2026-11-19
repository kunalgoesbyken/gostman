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
	"strconv"
)

const (
	corruptSuffix = ".corrupt"
	emptySection  = "[]"
)

var sectionsSplit bool

type carriedSections struct {
	History json.RawMessage `json:"history"`
	Cookies json.RawMessage `json:"cookies"`
}

type section struct {
	key     string
	path    string
	carried func(carriedSections) json.RawMessage
}

var sections = []section{historySection, cookiesSection}

func (c carriedSections) listed() bool {
	return len(c.History) > 0 || len(c.Cookies) > 0
}

func holdsSection(raw json.RawMessage) bool {
	return len(raw) > 0 && !bytes.Equal(raw, []byte("null"))
}

func (s section) label() string {
	return s.key + " file"
}

func (s section) files() []string {
	return []string{s.path, s.path + corruptSuffix}
}

func (s section) read() []byte {
	content, err := os.ReadFile(s.path)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		log.Printf("the %s could not be read: %v", s.label(), err)
	}
	return bytes.TrimSpace(content)
}

func (s section) setAside() {
	err := os.Rename(s.path, s.path+corruptSuffix)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		log.Printf("the damaged %s was not set aside: %v", s.label(), err)
	}
}

func (s section) write(content []byte) error {
	return writeAtomic(s.path, s.label(), content)
}

func (s section) document() json.RawMessage {
	raw := s.read()
	var items []json.RawMessage
	if json.Unmarshal(raw, &items) != nil || items == nil {
		return noDocument(s)
	}
	return raw
}

func noDocument(section) json.RawMessage {
	return json.RawMessage(emptySection)
}

func sectionFiles() []string {
	var files []string
	for _, s := range sections {
		files = append(files, s.files()...)
	}
	return files
}

type storedData struct {
	SavedData
	History json.RawMessage `json:"history,omitempty"`
	Cookies json.RawMessage `json:"cookies,omitempty"`
}

func (s storedData) carried() carriedSections {
	return carriedSections{History: s.History, Cookies: s.Cookies}
}

func readDataFile() ([]byte, error) {
	file, err := os.ReadFile(jsonfilePath)
	if errors.Is(err, fs.ErrNotExist) || (err == nil && len(file) == 0) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to read data file: %w", err)
	}
	return file, nil
}

func decodeDataFile(file []byte, into any) error {
	if len(file) == 0 {
		return nil
	}
	if err := json.Unmarshal(file, into); err != nil {
		return fmt.Errorf("data file is corrupted: %w", err)
	}
	return nil
}

func readInto(into any) error {
	file, err := readDataFile()
	if err != nil {
		return err
	}
	return decodeDataFile(file, into)
}

func readStored() (storedData, error) {
	var stored storedData
	err := readInto(&stored)
	return stored, err
}

func readSettings() (Settings, error) {
	var document struct {
		Settings Settings `json:"settings"`
	}
	err := readInto(&document)
	return document.Settings, err
}

func loadSection[T any](s section, stored storedData) []T {
	raw := s.carried(stored.carried())
	fromFile := !holdsSection(raw)
	if fromFile {
		raw = s.read()
	}
	if len(raw) == 0 {
		return nil
	}
	var items []T
	if err := json.Unmarshal(raw, &items); err != nil {
		log.Printf("the %s was not loaded: %v", s.label(), err)
		if fromFile {
			s.setAside()
		}
		return nil
	}
	return items
}

func saveSection[T any](s section, items []T) error {
	dataMutex.Lock()
	defer dataMutex.Unlock()
	if !sectionsSplit {
		if err := migrateSectionsLocked(); err != nil {
			return err
		}
	}
	if items == nil {
		items = []T{}
	}
	encoded, err := json.Marshal(items)
	if err != nil {
		return fmt.Errorf("failed to encode %s: %w", s.key, err)
	}
	return s.write(encoded)
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

func writeStored(stored storedData) error {
	carried := stored.carried()
	for _, s := range sections {
		if raw := s.carried(carried); holdsSection(raw) {
			if err := s.write(raw); err != nil {
				return err
			}
		}
	}
	if err := writeData(stored.SavedData); err != nil {
		return err
	}
	sectionsSplit = true
	return nil
}

func migrateSectionsLocked() error {
	file, err := readDataFile()
	if err != nil {
		return err
	}
	var carried carriedSections
	if err := decodeDataFile(file, &carried); err != nil {
		return err
	}
	if !carried.listed() {
		sectionsSplit = true
		return nil
	}
	var stored storedData
	if err := decodeDataFile(file, &stored); err != nil {
		return err
	}
	return writeStored(stored)
}

func migrateSections() {
	dataMutex.Lock()
	defer dataMutex.Unlock()
	if err := migrateSectionsLocked(); err != nil {
		log.Printf("the history and cookies were not moved to their own files: %v", err)
	}
}

func withSections(content []byte, fallback func(section) json.RawMessage) []byte {
	var carried carriedSections
	if json.Unmarshal(content, &carried) != nil {
		return content
	}
	object, closed := bytes.CutSuffix(bytes.TrimRight(content, " \t\r\n"), []byte("}"))
	if !closed {
		return content
	}
	object = bytes.TrimRight(object, " \t\r\n")
	needsComma := !bytes.HasSuffix(object, []byte("{"))
	merged := bytes.NewBuffer(make([]byte, 0, len(object)+len(sections)*64))
	merged.Write(object)
	for _, s := range sections {
		if holdsSection(s.carried(carried)) {
			continue
		}
		if needsComma {
			merged.WriteByte(',')
		}
		needsComma = true
		merged.WriteString(strconv.Quote(s.key))
		merged.WriteByte(':')
		merged.Write(fallback(s))
	}
	merged.WriteByte('}')
	return merged.Bytes()
}
