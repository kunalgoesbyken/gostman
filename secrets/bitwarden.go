package secrets

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	bitwardenSessionEnv  = "BW_SESSION"
	bitwardenLinkedField = 3
	entryNotes           = "notes"
	entryURI             = "uri"
)

var (
	bitwardenTool = tool{
		program: "bw",
		label:   "Bitwarden CLI (bw)",
		install: "https://bitwarden.com/help/cli/",
		timeout: 30 * time.Second,
	}
	errBitwardenLoggedOut = errors.New("Bitwarden CLI is not logged in. Run bw login in a terminal, then bw unlock --raw, and paste the session key into the connection")
	errBitwardenLocked    = errors.New("the Bitwarden session key is missing or no longer valid. Run bw unlock --raw in a terminal and paste the new session key into the connection")
	bitwardenLinks        = map[int]string{100: entryUsername, 101: entryPassword}
)

type bitwarden struct {
	session string
	program string
}

type bitwardenEnvelope struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type bitwardenField struct {
	Name     string  `json:"name"`
	Value    *string `json:"value"`
	Type     int     `json:"type"`
	LinkedID *int    `json:"linkedId"`
}

type bitwardenItem struct {
	ID     string           `json:"id"`
	Name   string           `json:"name"`
	Notes  *string          `json:"notes"`
	Fields []bitwardenField `json:"fields"`
	Login  *struct {
		Username *string `json:"username"`
		Password *string `json:"password"`
		URIs     []struct {
			URI *string `json:"uri"`
		} `json:"uris"`
	} `json:"login"`
}

func newBitwarden(connection Connection, _ *gateway) (Provider, error) {
	provider := &bitwarden{session: connection.value(fieldSession), program: connection.value(fieldCommand)}
	if provider.session == "" {
		return nil, errors.New("needs a session key from bw unlock --raw")
	}
	return provider, nil
}

func (b *bitwarden) Volatile(ref Ref) bool {
	return readsOneTimeCode(ref)
}

func (b *bitwarden) call(ctx context.Context, program string, answer any, command []string, targets ...string) error {
	args := append(command, "--nointeraction", "--response")
	if len(targets) > 0 {
		args = append(append(args, "--"), targets...)
	}
	result, err := bitwardenTool.run(ctx, program, args, map[string]string{bitwardenSessionEnv: b.session})
	if err != nil {
		return err
	}
	var envelope bitwardenEnvelope
	if json.Unmarshal(result.stdout, &envelope) != nil {
		if message := firstLine(result.stderr); message != "" {
			return fmt.Errorf("Bitwarden CLI: %s", message)
		}
		return errors.New("Bitwarden CLI gave an answer that could not be read")
	}
	if !envelope.Success {
		return bitwardenProblem(envelope.Message)
	}
	if json.Unmarshal(envelope.Data, answer) != nil {
		return errors.New("Bitwarden CLI gave an answer that could not be read")
	}
	return nil
}

func bitwardenProblem(message string) error {
	switch message {
	case "You are not logged in.":
		return errBitwardenLoggedOut
	case "Vault is locked.":
		return errBitwardenLocked
	case "Not found.":
		return errors.New("Bitwarden has no item with that ID")
	}
	return fmt.Errorf("Bitwarden CLI: %s", firstLine(message))
}

func (b *bitwarden) item(ctx context.Context, program, path string) (bitwardenItem, error) {
	var item bitwardenItem
	if isGUID(path) {
		return item, b.call(ctx, program, &item, []string{"get", "item"}, path)
	}
	var listing struct {
		Data []bitwardenItem `json:"data"`
	}
	if err := b.call(ctx, program, &listing, []string{"list", "items", "--search=" + path}); err != nil {
		return item, err
	}
	var matches []bitwardenItem
	for _, candidate := range listing.Data {
		if candidate.Name == path {
			matches = append(matches, candidate)
		}
	}
	switch len(matches) {
	case 0:
		return item, fmt.Errorf("Bitwarden has no item named %q. Names must match exactly; run bw sync if you added it recently", path)
	case 1:
		return matches[0], nil
	}
	ids := make([]string, len(matches))
	for i, match := range matches {
		ids[i] = match.ID
	}
	return item, fmt.Errorf("%d Bitwarden items are named %q; use the ID of the one you mean: %s", len(matches), path, strings.Join(ids, ", "))
}

func (b *bitwarden) Resolve(ctx context.Context, ref Ref) (string, error) {
	if err := noVersions(ref, "Bitwarden"); err != nil {
		return "", err
	}
	program, err := bitwardenTool.locate(b.program)
	if err != nil {
		return "", err
	}
	item, err := b.item(ctx, program, strings.TrimSpace(ref.Path))
	if err != nil {
		return "", err
	}
	if ref.Field == entryTOTP {
		var code struct {
			Data string `json:"data"`
		}
		if err := b.call(ctx, program, &code, []string{"get", "totp"}, item.ID); err != nil {
			return "", err
		}
		return code.Data, nil
	}
	return item.read(ref.Field)
}

func text(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func (i bitwardenItem) fields() map[string]string {
	fields := map[string]string{}
	builtIn := map[string]string{entryNotes: text(i.Notes)}
	if i.Login != nil {
		builtIn[entryUsername] = text(i.Login.Username)
		builtIn[entryPassword] = text(i.Login.Password)
		if len(i.Login.URIs) > 0 {
			builtIn[entryURI] = text(i.Login.URIs[0].URI)
		}
	}
	for _, field := range i.Fields {
		value := text(field.Value)
		if field.Type == bitwardenLinkedField && field.LinkedID != nil {
			value = builtIn[bitwardenLinks[*field.LinkedID]]
		}
		fields[field.Name] = value
	}
	for name, value := range builtIn {
		fields[name] = value
	}
	return fields
}

func (i bitwardenItem) read(field string) (string, error) {
	return pickField(i.fields(), field, entryPassword, "")
}
