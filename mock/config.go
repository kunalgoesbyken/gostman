package mock

import (
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
	ConfigFileName = ".gostman/mock.yaml"
	maxConfigBytes = 64 << 20
)

type RouteOptions struct {
	Disabled bool     `json:"disabled"`
	Behavior Behavior `json:"behavior"`
}

type Spec struct {
	Title   string   `json:"title"`
	Sources []Source `json:"sources"`
}

type Config struct {
	Settings   Settings                `json:"settings"`
	Spec       Spec                    `json:"spec"`
	Rules      []Rule                  `json:"rules"`
	Routes     map[string]RouteOptions `json:"routes"`
	Selections map[string]string       `json:"selections"`
}

func DefaultConfig() Config {
	return Config{
		Settings:   Settings{Port: DefaultPort},
		Spec:       Spec{Sources: []Source{}},
		Rules:      []Rule{},
		Routes:     map[string]RouteOptions{},
		Selections: map[string]string{},
	}
}

func (c Config) compose(sources []Source) []Source {
	composed := make([]Source, 0, len(sources)+len(c.Spec.Sources))
	composed = append(composed, sources...)
	composed = append(composed, c.Spec.Sources...)
	for i := range composed {
		composed[i] = c.apply(composed[i])
	}
	return composed
}

func (c Config) apply(source Source) Source {
	if chosen := c.Selections[source.ID]; chosen != "" {
		source.ExampleID = chosen
	}
	options := c.Routes[source.ID]
	source.Disabled, source.Behavior = options.Disabled, options.Behavior
	return source
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
		return config, fmt.Errorf("the mock configuration is larger than %d MB", maxConfigBytes>>20)
	}
	if err := fromYAML(data, &config); err != nil {
		return DefaultConfig(), fmt.Errorf("the mock configuration is not valid: %w", err)
	}
	return config, nil
}

func SaveConfig(path string, config Config) error {
	data, err := toYAML(config)
	if err != nil {
		return err
	}
	if len(data) > maxConfigBytes {
		return fmt.Errorf("the mock configuration is larger than %d MB", maxConfigBytes>>20)
	}
	directory := filepath.Dir(path)
	if err := os.MkdirAll(directory, 0o755); err != nil {
		return err
	}
	staging, err := os.CreateTemp(directory, "mock-*.tmp")
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

func toYAML(config Config) ([]byte, error) {
	encoded, err := json.Marshal(config)
	if err != nil {
		return nil, err
	}
	var generic any
	if err := json.Unmarshal(encoded, &generic); err != nil {
		return nil, err
	}
	return yaml.Marshal(generic)
}

func fromYAML(data []byte, config *Config) error {
	var generic any
	if err := yaml.Unmarshal(data, &generic); err != nil {
		return err
	}
	encoded, err := json.Marshal(generic)
	if err != nil {
		return err
	}
	return json.Unmarshal(encoded, config)
}
