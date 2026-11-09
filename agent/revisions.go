package agent

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/kunalgoesbyken/gostman/workspace"
)

const sessionPrefix = "agent-"

var readingTools = map[string]string{
	workspace.ChangeRequest:     "get_request",
	workspace.ChangeEnvironment: "list_environments",
}

func newSession(named string) string {
	if name := strings.TrimSpace(named); name != "" {
		return name
	}
	suffix := make([]byte, 2)
	_, _ = rand.Read(suffix)
	return sessionPrefix + hex.EncodeToString(suffix)
}

func revisionKey(kind, key string) string {
	return kind + ":" + key
}

func (d *Desk) remember(kind, key, digest string) {
	if digest != "" {
		d.revisions[revisionKey(kind, key)] = digest
	}
}

func (d *Desk) requestRevision(id string) (string, error) {
	digest, err := d.files.RequestRevision(id)
	d.remember(workspace.ChangeRequest, id, digest)
	return digest, err
}

func (d *Desk) environmentRevision(name string) (string, error) {
	digest, err := d.files.EnvironmentRevision(name)
	d.remember(workspace.ChangeEnvironment, name, digest)
	return digest, err
}

func (d *Desk) otherWriter(kind, key string) string {
	changes, err := d.files.Changes()
	if err != nil {
		return ""
	}
	last, found := workspace.LastChange(changes, kind, key)
	if !found || last.Session == d.session {
		return ", not by an agent session (the Gostman app, an editor or git)"
	}
	return fmt.Sprintf(", by session %s at %s", last.Session, last.At)
}

func (d *Desk) checkRevision(kind, key, label, supplied, current string) error {
	expected := supplied
	if expected == "" {
		expected = d.revisions[revisionKey(kind, key)]
	}
	if expected == "" || expected == current {
		return nil
	}
	return fmt.Errorf("Not saved: %s changed since you read it (you have revision %s, it is now %s)%s. Call %s again and make your edit on the current version.",
		label, expected, current, d.otherWriter(kind, key), readingTools[kind])
}

func (d *Desk) record(changes ...workspace.Change) string {
	if err := d.files.RecordChanges(d.session, changes...); err != nil {
		return fmt.Sprintf("Saved, but the change could not be recorded in the change journal: %s", err)
	}
	return ""
}

func changeOf(kind, name, id string, created bool) workspace.Change {
	action := workspace.ChangeUpdated
	if created {
		action = workspace.ChangeCreated
	}
	return workspace.Change{Kind: kind, Name: name, ID: id, Action: action}
}
