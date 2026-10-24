package workspace

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"sort"
)

const (
	agentDirectory      = ".gostman"
	agentLedger         = agentDirectory + "/agent-requests.json"
	agentVariableLedger = agentDirectory + "/agent-variables.json"
)

type AgentValues map[string]map[string]string

func Fingerprint(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func (w *Workspace) readLedger(path string, target any) error {
	content, err := w.disk.read(path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if err := json.Unmarshal(content, target); err != nil {
		return fmt.Errorf("%s cannot be read: %w", path, err)
	}
	return nil
}

func (w *Workspace) writeLedger(path string, value any) error {
	content, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	if err := w.disk.makeDirectory(agentDirectory); err != nil {
		return err
	}
	return w.disk.write(path, append(content, '\n'))
}

func (w *Workspace) readAgentLedger() (map[string]bool, error) {
	var ids []string
	if err := w.readLedger(agentLedger, &ids); err != nil {
		return nil, err
	}
	authored := map[string]bool{}
	for _, id := range ids {
		authored[id] = true
	}
	return authored, nil
}

func (w *Workspace) AgentAuthored() (map[string]bool, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.readAgentLedger()
}

func (w *Workspace) MarkAgentAuthored(ids ...string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	authored, err := w.readAgentLedger()
	if err != nil {
		return err
	}
	grown := false
	for _, id := range ids {
		grown = grown || !authored[id]
		authored[id] = true
	}
	if !grown {
		return nil
	}
	listed := make([]string, 0, len(authored))
	for id := range authored {
		listed = append(listed, id)
	}
	sort.Strings(listed)
	return w.writeLedger(agentLedger, listed)
}

func (w *Workspace) readVariableLedger() (AgentValues, error) {
	written := AgentValues{}
	if err := w.readLedger(agentVariableLedger, &written); err != nil {
		return nil, err
	}
	return written, nil
}

func (w *Workspace) AgentVariables() (AgentValues, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.readVariableLedger()
}

func (w *Workspace) MarkAgentVariables(environmentID string, values map[string]string) error {
	if len(values) == 0 {
		return nil
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	written, err := w.readVariableLedger()
	if err != nil {
		return err
	}
	if written[environmentID] == nil {
		written[environmentID] = map[string]string{}
	}
	for name, value := range values {
		written[environmentID][name] = Fingerprint(value)
	}
	return w.writeLedger(agentVariableLedger, written)
}
