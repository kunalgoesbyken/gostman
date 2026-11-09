package workspace

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"time"
)

const (
	ChangeRequest     = "request"
	ChangeEnvironment = "environment"
	ChangeCreated     = "created"
	ChangeUpdated     = "updated"

	DefaultChangeWindow = time.Hour

	changeJournal    = agentDirectory + "/changes.jsonl"
	changeTimeLayout = "2006-01-02T15:04:05.000Z"
	journalLimit     = 2000
	journalKept      = 1000
)

type Change struct {
	At      string `json:"at"`
	Session string `json:"session"`
	Kind    string `json:"kind"`
	Name    string `json:"name"`
	ID      string `json:"id"`
	Action  string `json:"action"`
}

func (c Change) Time() (time.Time, error) {
	return time.Parse(changeTimeLayout, c.At)
}

func (c Change) Summary() string {
	return fmt.Sprintf("%s %s %s %s %q", c.At, c.Session, c.Action, c.Kind, c.Name)
}

func (c Change) Touches(kind, key string) bool {
	if c.Kind != kind {
		return false
	}
	if kind == ChangeRequest {
		return c.ID == key
	}
	return c.Name == key
}

func ParseChangeWindow(text string) (time.Duration, error) {
	if text == "" {
		return DefaultChangeWindow, nil
	}
	window, err := time.ParseDuration(text)
	if err != nil || window <= 0 {
		return 0, fmt.Errorf("%q is not a duration such as 5m or 2h", text)
	}
	return window, nil
}

func RecentChanges(changes []Change, window time.Duration, now time.Time, session string) []Change {
	var recent []Change
	for _, change := range changes {
		at, err := change.Time()
		if err != nil || now.Sub(at) > window || (session != "" && change.Session != session) {
			continue
		}
		recent = append(recent, change)
	}
	return recent
}

type ChangeFeed struct {
	Changes []Change `json:"changes"`
	Summary []string `json:"summary"`
}

func NewChangeFeed(changes []Change) ChangeFeed {
	feed := ChangeFeed{Changes: make([]Change, 0, len(changes)), Summary: make([]string, 0, len(changes))}
	for _, change := range changes {
		feed.Changes = append(feed.Changes, change)
		feed.Summary = append(feed.Summary, change.Summary())
	}
	return feed
}

func LastChange(changes []Change, kind, key string) (Change, bool) {
	for index := len(changes) - 1; index >= 0; index-- {
		if changes[index].Touches(kind, key) {
			return changes[index], true
		}
	}
	return Change{}, false
}

func journalLines(content []byte) [][]byte {
	var lines [][]byte
	for _, line := range bytes.Split(content, []byte("\n")) {
		if len(bytes.TrimSpace(line)) > 0 {
			lines = append(lines, line)
		}
	}
	return lines
}

func parseChange(line []byte) (Change, bool) {
	var change Change
	if json.Unmarshal(line, &change) != nil || change.Kind == "" {
		return Change{}, false
	}
	_, err := change.Time()
	return change, err == nil
}

func (w *Workspace) Changes() ([]Change, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	content, err := w.disk.read(changeJournal)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("the change journal cannot be read: %w", err)
	}
	var changes []Change
	for _, line := range journalLines(content) {
		if change, valid := parseChange(line); valid {
			changes = append(changes, change)
		}
	}
	return changes, nil
}

func (w *Workspace) appendToJournal(lines []byte) error {
	if err := w.disk.makeDirectory(agentDirectory); err != nil {
		return err
	}
	target, err := w.disk.resolve(changeJournal)
	if err != nil {
		return err
	}
	if info, err := os.Lstat(target); err == nil && !info.Mode().IsRegular() {
		return fmt.Errorf("%s is not a regular file", changeJournal)
	}
	file, err := os.OpenFile(target, os.O_APPEND|os.O_CREATE|os.O_WRONLY, filePermissions)
	if err != nil {
		return err
	}
	_, err = file.Write(lines)
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	return err
}

func (w *Workspace) trimJournal() {
	content, err := w.disk.read(changeJournal)
	if err != nil {
		return
	}
	lines := journalLines(content)
	if len(lines) <= journalLimit {
		return
	}
	kept := append(bytes.Join(lines[len(lines)-journalKept:], []byte("\n")), '\n')
	_ = w.disk.write(changeJournal, kept)
}

func (w *Workspace) RecordChanges(session string, changes ...Change) error {
	if len(changes) == 0 {
		return nil
	}
	now := time.Now().UTC().Format(changeTimeLayout)
	var lines []byte
	for _, change := range changes {
		change.At, change.Session = now, session
		line, err := json.Marshal(change)
		if err != nil {
			return fmt.Errorf("a change cannot be recorded: %w", err)
		}
		lines = append(append(lines, line...), '\n')
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	if err := w.appendToJournal(lines); err != nil {
		return fmt.Errorf("the change journal cannot be written: %w", err)
	}
	w.trimJournal()
	return nil
}
