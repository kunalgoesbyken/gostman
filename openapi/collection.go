package openapi

import (
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"strings"
)

type Folder struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	IsOpen   bool   `json:"isOpen"`
	ParentID string `json:"parentId"`
}

type OperationRef struct {
	Key         string `json:"key"`
	OperationID string `json:"operationId"`
	Hash        string `json:"hash"`
	Tag         string `json:"tag"`
	Deprecated  bool   `json:"deprecated"`
}

type Collection struct {
	Title      string            `json:"title"`
	Version    string            `json:"version"`
	Hash       string            `json:"hash"`
	Total      int               `json:"total"`
	Folders    []Folder          `json:"folders"`
	Requests   []Request         `json:"requests"`
	Operations []OperationRef    `json:"operations"`
	Variables  map[string]string `json:"variables"`
	Warnings   []string          `json:"warnings"`
}

type Selection struct {
	Offset int
	Limit  int
	Keys   []string
}

func (d *Document) RootFolderName() string {
	name := strings.TrimSpace(d.Info.Title)
	if name == "" {
		name = "API"
	}
	if runes := []rune(name); len(runes) > maxNameLength {
		name = string(runes[:maxNameLength])
	}
	return name
}

func (d *Document) folderID(name string) string {
	sum := sha256.Sum256([]byte(d.Hash + "|" + name))
	return uuidFormat(sum[:16])
}

func uuidFormat(b []byte) string {
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func randomID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return uuidFormat(b)
}

func (d *Document) Folders() []Folder {
	rootID := d.folderID("")
	folders := []Folder{{ID: rootID, Name: d.RootFolderName(), IsOpen: true}}
	used := map[string]bool{}
	for _, op := range d.ops {
		used[op.Tag()] = true
	}
	for _, tag := range d.Tags {
		if used[tag.Name] {
			folders = append(folders, Folder{ID: d.folderID(tag.Name), Name: truncate(tag.Name), ParentID: rootID})
		}
	}
	return folders
}

func truncate(name string) string {
	if runes := []rune(name); len(runes) > maxNameLength {
		return string(runes[:maxNameLength])
	}
	return name
}

func (d *Document) Variables() map[string]string {
	return map[string]string{BaseURLVariable: d.BaseURL()}
}

func (d *Document) collectionWarnings() []string {
	warnings := append([]string{}, d.l.warningList()...)
	base := d.BaseURL()
	switch {
	case base == "":
		warnings = append(warnings, "The spec lists no server URL. Set the baseUrl variable in your environment.")
	case !strings.HasPrefix(base, "http://") && !strings.HasPrefix(base, "https://"):
		warnings = append(warnings, fmt.Sprintf("The server URL %q is relative. Set the baseUrl variable in your environment.", base))
	}
	if len(d.Servers) > 1 {
		warnings = append(warnings, fmt.Sprintf("The spec lists %d servers. baseUrl uses the first one.", len(d.Servers)))
	}
	return warnings
}

func (d *Document) Generate(selection Selection) Collection {
	selected := d.selectOperations(selection)
	collection := Collection{
		Title:      d.RootFolderName(),
		Version:    d.Info.Version,
		Hash:       d.Hash,
		Total:      len(d.ops),
		Requests:   make([]Request, 0, len(selected)),
		Operations: make([]OperationRef, 0, len(selected)),
		Variables:  d.Variables(),
	}
	if len(selection.Keys) == 0 && selection.Offset == 0 {
		collection.Folders = d.Folders()
	}
	for _, op := range selected {
		request := *d.GenerateRequest(op)
		request.ID = randomID()
		if len(selection.Keys) == 0 {
			request.FolderID = d.folderID(op.Tag())
		}
		collection.Requests = append(collection.Requests, request)
		collection.Operations = append(collection.Operations, op.ref())
	}
	collection.Warnings = d.collectionWarnings()
	return collection
}

func (o *Operation) ref() OperationRef {
	return OperationRef{Key: o.Key, OperationID: o.OperationID, Hash: o.Hash, Tag: o.Tag(), Deprecated: o.Deprecated}
}

func (d *Document) selectOperations(selection Selection) []*Operation {
	if len(selection.Keys) > 0 {
		var chosen []*Operation
		for _, key := range selection.Keys {
			if op, ok := d.byKey[key]; ok {
				chosen = append(chosen, op)
			}
		}
		return chosen
	}
	start := selection.Offset
	if start < 0 || start > len(d.ops) {
		start = len(d.ops)
	}
	end := len(d.ops)
	if selection.Limit > 0 && start+selection.Limit < end {
		end = start + selection.Limit
	}
	return d.ops[start:end]
}
