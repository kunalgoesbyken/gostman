package agent

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/scan"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	scannedEnvironment = "set_variables"
	emptyObject        = "{}"
)

type variableArguments struct {
	Environment string            `json:"environment"`
	Variables   map[string]string `json:"variables"`
}

type variableChange struct {
	Environment string   `json:"environment"`
	Created     bool     `json:"created"`
	Set         []string `json:"set"`
	Active      bool     `json:"active"`
	Overridden  []string `json:"overriddenByCommandLine,omitempty"`
	Note        string   `json:"note,omitempty"`
}

type variableSettings map[string]struct {
	Secret bool            `json:"secret"`
	Ref    json.RawMessage `json:"ref"`
}

func withValues(text string, values map[string]string, overwrite bool) (string, map[string]string, error) {
	entries, err := workspace.ParseVariableEntries(text)
	if err != nil {
		return "", nil, err
	}
	positions := map[string]int{}
	for index, entry := range entries {
		positions[entry.Name] = index
	}
	written := map[string]string{}
	for _, name := range sortedKeys(values) {
		encoded, err := json.Marshal(values[name])
		if err != nil {
			return "", nil, err
		}
		position, exists := positions[name]
		switch {
		case exists && !overwrite:
			continue
		case exists:
			entries[position].Raw = encoded
		default:
			entries = append(entries, workspace.VariableEntry{Name: name, Raw: encoded})
		}
		written[name] = values[name]
	}
	return workspace.EncodeVariableEntries(entries), written, nil
}

func currentValues(text string) map[string]string {
	values := map[string]string{}
	entries, _ := workspace.ParseVariableEntries(text)
	for _, entry := range entries {
		if value, isText := plainValue(entry.Raw); isText {
			values[entry.Name] = value
		}
	}
	return values
}

func markedSecret(meta string) (map[string]bool, error) {
	var settings variableSettings
	if hasText(meta) && json.Unmarshal([]byte(meta), &settings) != nil {
		return nil, errors.New("Not saved: an environment's variable settings cannot be read; change it in the Gostman app.")
	}
	marked := map[string]bool{}
	for name, setting := range settings {
		marked[name] = setting.Secret || (len(setting.Ref) > 0 && string(setting.Ref) != "null")
	}
	return marked, nil
}

func secretNames(environments []workspace.Environment) map[string]bool {
	names := map[string]bool{}
	for _, environment := range environments {
		marked, _ := markedSecret(environment.Meta)
		for name, secret := range marked {
			names[name] = names[name] || secret
		}
	}
	return names
}

func refuseMarked(meta string, values map[string]string) error {
	marked, err := markedSecret(meta)
	if err != nil {
		return err
	}
	for name := range values {
		if marked[name] {
			return fmt.Errorf("Not saved: %q is a secret or reads a secret manager; only the developer changes it, in the Gostman app.", name)
		}
	}
	return nil
}

func (d *Desk) credentialIn(texts []string, marked map[string]bool) (string, bool) {
	for _, text := range texts {
		for _, label := range d.client.guard.Labels(text) {
			if strings.HasPrefix(label, hiddenPrefix) || redact.IsSensitiveName(label) || marked[label] {
				return label, true
			}
		}
	}
	return "", false
}

func (d *Desk) refuseCredentialValues(texts []string, marked map[string]bool) error {
	if label, found := d.credentialIn(texts, marked); found {
		return leak(label)
	}
	return nil
}

func refuseCredentialNames(values map[string]string) error {
	for name := range values {
		switch {
		case !hasText(name):
			return errors.New("Every variable needs a name.")
		case redact.IsSensitiveName(name):
			return fmt.Errorf("Not saved: %q is named like a credential. The developer sets credentials in the Gostman app or with --var-from-env.", name)
		}
	}
	return nil
}

func refuseLookalikes(values map[string]string) error {
	encoded, err := json.Marshal(values)
	if err != nil {
		return err
	}
	report := scan.Scan(workspace.Collection{Environments: []workspace.Environment{{Name: scannedEnvironment, Variables: string(encoded)}}}, scan.Options{})
	if len(report.Findings) > 0 {
		finding := report.Findings[0]
		return fmt.Errorf("Not saved: %s looks like a credential (%s). The developer sets credentials in the Gostman app or with --var-from-env.", finding.Location.Field, finding.Reason)
	}
	return nil
}

func (d *Desk) checkVariables(values map[string]string, existing map[string]string, marked map[string]bool) error {
	if err := refuseCredentialNames(values); err != nil {
		return err
	}
	var supplied []string
	for name, value := range values {
		if existing[name] != value {
			supplied = append(supplied, name, value)
		}
	}
	if err := refuseFileReads(supplied); err != nil {
		return err
	}
	if err := d.refuseCredentialValues(supplied, marked); err != nil {
		return err
	}
	return refuseLookalikes(values)
}

func (d *Desk) applyToSession(values map[string]string) []string {
	var overridden []string
	applied := map[string]string{}
	for name, value := range values {
		if _, fixed := d.startup[name]; fixed {
			overridden = append(overridden, name)
			continue
		}
		applied[name] = value
	}
	d.client.SetVariables(applied)
	return sorted(overridden)
}

func (d *Desk) setVariables(_ context.Context, current scene, arguments variableArguments) (variableChange, error) {
	if len(arguments.Variables) == 0 {
		return variableChange{}, errors.New("Give at least one variable in variables.")
	}
	name := strings.TrimSpace(arguments.Environment)
	if name == "" {
		name = d.client.session.Environment()
	}
	if name == "" {
		return variableChange{}, unnamedEnvironment(current.files.Environments)
	}
	environments := append([]workspace.Environment{}, current.files.Environments...)
	change := variableChange{Environment: name, Active: name == d.client.session.Environment()}
	position := environmentNamed(environments, name)
	if position < 0 {
		environments = append(environments, workspace.Environment{Id: rand.Text(), Name: name, Variables: emptyObject, Meta: emptyObject})
		position, change.Created = len(environments)-1, true
	}
	target := &environments[position]
	if err := d.checkVariables(arguments.Variables, currentValues(target.Variables), secretNames(environments)); err != nil {
		return variableChange{}, err
	}
	if err := refuseMarked(target.Meta, arguments.Variables); err != nil {
		return variableChange{}, err
	}
	text, written, err := withValues(target.Variables, arguments.Variables, true)
	if err != nil {
		return variableChange{}, fmt.Errorf("Not saved: environment %q: %w", name, err)
	}
	target.Variables = text
	if err := d.files.MarkAgentVariables(target.Id, written); err != nil {
		return variableChange{}, err
	}
	if err := d.files.SaveEnvironments(environments); err != nil {
		return variableChange{}, err
	}
	change.Set = sortedKeys(written)
	if change.Active {
		change.Overridden = d.applyToSession(written)
	} else {
		change.Note = fmt.Sprintf("Saved, but %q is not the active environment, so requests in this session do not use these values yet. Call set_environment with %q to use them.", name, name)
	}
	return change, nil
}

func unnamedEnvironment(environments []workspace.Environment) error {
	if len(environments) == 0 {
		return errors.New("Name the environment. The workspace has none yet; a new name such as Local creates one.")
	}
	names := make([]string, 0, len(environments))
	for _, environment := range environments {
		names = append(names, environment.Name)
	}
	return fmt.Errorf("Name the environment: no environment is active in this session. The workspace has %s; a new name creates one. set_environment makes one active.", strings.Join(names, ", "))
}
