package runner

import (
	"encoding/json"
	"fmt"

	"github.com/kunalgoesbyken/gostman/workspace"
)

const snapshotUpdated = "snapshot updated"

type SnapshotUpdate struct {
	Name        string `json:"name"`
	Expression  string `json:"expression"`
	Value       string `json:"value"`
	Replacement string `json:"replacement"`
	Changed     bool   `json:"changed"`
}

func (s *session) refreshSnapshots(request Request, received json.RawMessage, outcome *exchange) error {
	if !s.updateSnapshots {
		return nil
	}
	var refreshes []SnapshotUpdate
	if err := s.scripts.Call("snapshotRefreshes", &refreshes, request.Assertions, received); err != nil {
		return err
	}
	for _, refresh := range refreshes {
		if !refresh.Changed {
			continue
		}
		outcome.snapshots = append(outcome.snapshots, refresh)
		for index := range outcome.tests {
			if outcome.tests[index].Name == refresh.Name && !outcome.tests[index].Passed {
				outcome.tests[index].Passed = true
				outcome.tests[index].Message = snapshotUpdated
			}
		}
	}
	return nil
}

func UpdateSnapshotFiles(root string, results []Result) (int, error) {
	files, err := workspace.Open(root)
	if err != nil {
		return 0, fmt.Errorf("cannot read the workspace: %w", err)
	}
	updates := map[string][]SnapshotUpdate{}
	for _, result := range results {
		if len(result.Snapshots) > 0 {
			updates[result.ID] = result.Snapshots
		}
	}
	var changed []workspace.Request
	count := 0
	for _, request := range files.Collection().Requests {
		replaced, n, err := replaceSnapshots(request.Assertions, updates[request.Id])
		if err != nil {
			return 0, err
		}
		if n == 0 {
			continue
		}
		request.Assertions = replaced
		changed = append(changed, request)
		count += n
	}
	if len(changed) == 0 {
		return 0, nil
	}
	return count, files.SaveRequests(changed)
}

func replaceSnapshots(assertions string, updates []SnapshotUpdate) (string, int, error) {
	if len(updates) == 0 {
		return assertions, 0, nil
	}
	var rows []map[string]any
	if err := json.Unmarshal([]byte(assertions), &rows); err != nil {
		return assertions, 0, fmt.Errorf("the assertions of a request cannot be read: %w", err)
	}
	count := 0
	for _, row := range rows {
		for _, update := range updates {
			if row["expression"] == update.Expression && row["value"] == update.Value && row["operator"] == "snapshot" {
				row["value"] = update.Replacement
				count++
				break
			}
		}
	}
	encoded, err := json.Marshal(rows)
	if err != nil {
		return assertions, 0, err
	}
	return string(encoded), count, nil
}
