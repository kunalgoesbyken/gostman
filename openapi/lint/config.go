package lint

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"sort"

	"gopkg.in/yaml.v3"
)

const ConfigFileName = ".gostman/lint.yaml"

type Config struct {
	Rules map[string]Severity `yaml:"rules" json:"rules"`
}

func ParseConfig(data []byte) (Config, error) {
	var config Config
	decoder := yaml.NewDecoder(bytes.NewReader(data))
	decoder.KnownFields(true)
	if err := decoder.Decode(&config); err != nil && !errors.Is(err, io.EOF) {
		return Config{}, fmt.Errorf("the lint configuration could not be read: %w", err)
	}
	return config, config.validate()
}

func LoadConfig(path string) (Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Config{}, err
	}
	return ParseConfig(data)
}

func LoadOptionalConfig(path string) (Config, error) {
	config, err := LoadConfig(path)
	if errors.Is(err, fs.ErrNotExist) {
		return Config{}, nil
	}
	return config, err
}

func (c Config) validate() error {
	known := map[string]bool{}
	for _, rule := range Rules() {
		known[rule.ID] = true
	}
	for _, id := range sortedRuleIDs(c.Rules) {
		if !known[id] {
			return fmt.Errorf("the lint configuration names an unknown rule %q", id)
		}
		if !c.Rules[id].configurable() {
			return fmt.Errorf("rule %q has severity %q; use error, warning, info or off", id, c.Rules[id])
		}
	}
	return nil
}

func sortedRuleIDs(rules map[string]Severity) []string {
	ids := make([]string, 0, len(rules))
	for id := range rules {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func (c Config) severityOf(rule Rule) Severity {
	if override, ok := c.Rules[rule.ID]; ok {
		return override
	}
	return rule.Severity
}
