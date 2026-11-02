package mock

import (
	"crypto/rand"
	"fmt"
)

const (
	RulesKind    = "gostman-mock-rules"
	rulesVersion = 1
)

type rulesFile struct {
	Kind    string `json:"kind"`
	Version int    `json:"version"`
	Rules   []Rule `json:"rules"`
}

func ExportRules(rules []Rule) ([]byte, error) {
	return ToYAML(rulesFile{Kind: RulesKind, Version: rulesVersion, Rules: rules})
}

func ImportRules(data []byte) ([]Rule, error) {
	var imported rulesFile
	if err := FromYAML(data, &imported); err != nil {
		return nil, fmt.Errorf("the file is not valid: %w", err)
	}
	if imported.Kind != RulesKind {
		return nil, fmt.Errorf("the file is not a Gostman mock rules file")
	}
	if err := checkRules(imported.Rules); err != nil {
		return nil, err
	}
	for i := range imported.Rules {
		imported.Rules[i].ID = rand.Text()
		imported.Rules[i].Disabled = true
	}
	return imported.Rules, nil
}
