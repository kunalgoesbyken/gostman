package capture

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

const (
	ConfigFileName = ".gostman/capture.yaml"
	RulesKind      = "gostman-capture-rules"
	rulesVersion   = 1
	maxConfigBytes = 16 << 20
)

type Config struct {
	Rules        []Rule `json:"rules"`
	BreakSeconds int    `json:"breakSeconds,omitempty"`
	Restricted   bool   `json:"restricted,omitempty"`
}

type rulesFile struct {
	Kind    string `json:"kind"`
	Version int    `json:"version"`
	Rules   []Rule `json:"rules"`
}

func DefaultConfig() Config {
	return Config{Rules: []Rule{}}
}

func (c Config) Withheld() Config {
	withheld := make([]Rule, len(c.Rules))
	for i, rule := range c.Rules {
		rule.Disabled = true
		withheld[i] = rule
	}
	c.Rules, c.Restricted = withheld, true
	return c
}

func LoadConfig(path string) (Config, error) {
	config := DefaultConfig()
	file, err := os.Open(path)
	if errors.Is(err, fs.ErrNotExist) {
		return config, nil
	}
	if err != nil {
		return config, err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxConfigBytes+1))
	if err != nil {
		return config, err
	}
	if len(data) > maxConfigBytes {
		return config, fmt.Errorf("the capture rules are larger than %d MB", maxConfigBytes>>20)
	}
	if err := fromYAML(data, &config); err != nil {
		return DefaultConfig(), fmt.Errorf("the capture rules are not valid: %w", err)
	}
	if config.Rules == nil {
		config.Rules = []Rule{}
	}
	return config, nil
}

func SaveConfig(path string, config Config) error {
	config.Restricted = false
	data, err := toYAML(config)
	if err != nil {
		return err
	}
	if len(data) > maxConfigBytes {
		return fmt.Errorf("the capture rules are larger than %d MB", maxConfigBytes>>20)
	}
	directory := filepath.Dir(path)
	if err := os.MkdirAll(directory, 0o755); err != nil {
		return err
	}
	staging, err := os.CreateTemp(directory, "capture-*.tmp")
	if err != nil {
		return err
	}
	defer os.Remove(staging.Name())
	if _, err := staging.Write(data); err != nil {
		staging.Close()
		return err
	}
	if err := staging.Close(); err != nil {
		return err
	}
	return os.Rename(staging.Name(), path)
}

func ExportRules(rules []Rule) ([]byte, error) {
	return toYAML(rulesFile{Kind: RulesKind, Version: rulesVersion, Rules: rules})
}

func ImportRules(data []byte, files bool) ([]Rule, error) {
	var imported rulesFile
	if err := fromYAML(data, &imported); err != nil {
		return nil, fmt.Errorf("the file is not valid: %w", err)
	}
	if imported.Kind != RulesKind {
		return nil, fmt.Errorf("the file is not a Gostman capture rules file")
	}
	if err := Validate(imported.Rules, files); err != nil {
		return nil, err
	}
	for i := range imported.Rules {
		imported.Rules[i].ID = rand.Text()
		imported.Rules[i].Disabled = true
	}
	return imported.Rules, nil
}

func toYAML(value any) ([]byte, error) {
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	var generic any
	if err := json.Unmarshal(encoded, &generic); err != nil {
		return nil, err
	}
	return yaml.Marshal(generic)
}

func fromYAML(data []byte, target any) error {
	var generic any
	if err := yaml.Unmarshal(data, &generic); err != nil {
		return err
	}
	encoded, err := json.Marshal(generic)
	if err != nil {
		return err
	}
	return json.Unmarshal(encoded, target)
}
