package workspace

import (
	"encoding/json"
	"sort"
)

const (
	agentDirectory = ".gostman"
	agentLedger    = agentDirectory + "/agent-requests.json"
)

func (w *Workspace) readAgentLedger() map[string]bool {
	authored := map[string]bool{}
	content, err := w.disk.read(agentLedger)
	if err != nil {
		return authored
	}
	var ids []string
	if json.Unmarshal(content, &ids) != nil {
		return authored
	}
	for _, id := range ids {
		authored[id] = true
	}
	return authored
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

func (w *Workspace) AgentAuthored() map[string]bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.readAgentLedger()
}

func (w *Workspace) MarkAgentAuthored(id string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	authored := w.readAgentLedger()
	if authored[id] {
		return nil
	}
	authored[id] = true
	return w.writeAgentLedger(authored)
}

func (w *Workspace) MarkReviewed(ids []string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	authored := w.readAgentLedger()
	changed := false
	for _, id := range ids {
		changed = changed || authored[id]
		delete(authored, id)
	}
	if !changed {
		return nil
	}
	return w.writeAgentLedger(authored)
}
