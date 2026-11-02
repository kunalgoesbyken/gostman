package capture

import (
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"

	"github.com/kunalgoesbyken/gostman/mock"
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
	if err := mock.FromYAML(data, &config); err != nil {
		return DefaultConfig(), fmt.Errorf("the capture rules are not valid: %w", err)
	}
	if config.Rules == nil {
		config.Rules = []Rule{}
	}
	return config, nil
}

func SaveConfig(path string, config Config) error {
	config.Restricted = false
	data, err := mock.ToYAML(config)
	if err != nil {
		return err
	}
	if len(data) > maxConfigBytes {
		return fmt.Errorf("the capture rules are larger than %d MB", maxConfigBytes>>20)
	}
	return mock.WriteAtomic(path, data, "capture-*.tmp")
}

func ExportRules(rules []Rule) ([]byte, error) {
	return mock.ToYAML(rulesFile{Kind: RulesKind, Version: rulesVersion, Rules: rules})
}

func ImportRules(data []byte, files bool) ([]Rule, error) {
	var imported rulesFile
	if err := mock.FromYAML(data, &imported); err != nil {
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
