package workspace

import (
	"encoding/json"
	"fmt"
	"sort"
)

const (
	agentDirectory = ".gostman"
	agentLedger    = agentDirectory + "/agent-requests.json"
)

func (w *Workspace) readAgentLedger() (map[string]bool, error) {
	authored := map[string]bool{}
	if !w.disk.exists(agentLedger) {
		return authored, nil
	}
	content, err := w.disk.read(agentLedger)
	if err != nil {
		return nil, err
	}
	var ids []string
	if err := json.Unmarshal(content, &ids); err != nil {
		return nil, fmt.Errorf("%s cannot be read: %w", agentLedger, err)
	}
	for _, id := range ids {
		authored[id] = true
	}
	return authored, nil
}

func (w *Workspace) writeAgentLedger(authored map[string]bool) error {
	ids := make([]string, 0, len(authored))
	for id := range authored {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	content, err := json.MarshalIndent(ids, "", "  ")
	if err != nil {
		return err
	}
	if err := w.disk.makeDirectory(agentDirectory); err != nil {
		return err
	}
	return w.disk.write(agentLedger, append(content, '\n'))
}

func (w *Workspace) AgentAuthored() (map[string]bool, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.readAgentLedger()
}

func (w *Workspace) MarkAgentAuthored(id string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	authored, err := w.readAgentLedger()
	if err != nil {
		return err
	}
	if authored[id] {
		return nil
	}
	authored[id] = true
	return w.writeAgentLedger(authored)
}
