package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/workspace"
)

type listFlag []string

func (l *listFlag) String() string {
	return strings.Join(*l, ",")
}

func (l *listFlag) Set(value string) error {
	if strings.TrimSpace(value) == "" {
		return errors.New("name a request")
	}
	*l = append(*l, value)
	return nil
}

type tagFlag []string

func (t *tagFlag) String() string {
	return strings.Join(*t, ",")
}

func (t *tagFlag) Set(value string) error {
	tags := workspace.NormalizeTags(strings.Split(value, ","))
	if len(tags) == 0 {
		return errors.New("name a tag")
	}
	*t = workspace.NormalizeTags(append(*t, tags...))
	return nil
}

type originFlags []string

func (o *originFlags) String() string {
	return strings.Join(*o, ",")
}

func (o *originFlags) Set(value string) error {
	if strings.TrimSpace(value) == "" {
		return errors.New("name an origin such as https://app.example.com")
	}
	*o = append(*o, value)
	return nil
}

type runExtras struct {
	dataFile      string
	envFile       string
	streamSeconds int
}

func (e *runExtras) register(flags *flag.FlagSet, options *runner.Options) {
	flags.StringVar(&e.dataFile, "data", "", "")
	flags.IntVar(&options.Iterations, "iterations", 0, "")
	flags.IntVar(&options.Parallel, "parallel", 0, "")
	flags.IntVar(&e.streamSeconds, "stream-timeout", 0, "")
	flags.StringVar(&e.envFile, "env-file", "", "")
	only := (*listFlag)(&options.Only)
	flags.Var(only, "only", "")
	flags.Var((*tagFlag)(&options.Tags), "tags", "")
	flags.Var((*tagFlag)(&options.ExcludeTags), "exclude-tags", "")
}

func (e runExtras) validate(options runner.Options) error {
	if options.Iterations < 0 || options.Parallel < 0 || e.streamSeconds < 0 {
		return errors.New("--iterations, --parallel and --stream-timeout take a number, zero or more")
	}
	return nil
}

func (e runExtras) apply(options *runner.Options, capture bool, secrets map[string]bool) error {
	if e.dataFile != "" {
		rows, err := runner.LoadData(e.dataFile)
		if err != nil {
			return err
		}
		options.Data = rows
	}
	if err := mergeSecretEnvFile(e.envFile, options.Variables, secrets); err != nil {
		return err
	}
	options.Capture = capture
	options.StreamTimeout = time.Duration(e.streamSeconds) * time.Second
	return nil
}

func warnShortData(stderr io.Writer, options runner.Options) {
	if rows := len(options.Data); rows > 0 && options.Iterations > rows {
		fmt.Fprintf(stderr, "warning: --iterations %d asks for more iterations than the data file has rows, so the run has %d, one per row\n", options.Iterations, rows)
	}
}

func unquote(value string) string {
	if len(value) >= 2 && (value[0] == '"' || value[0] == '\'') && value[len(value)-1] == value[0] {
		return value[1 : len(value)-1]
	}
	if cut := strings.Index(value, " #"); cut >= 0 {
		return strings.TrimSpace(value[:cut])
	}
	return value
}

func mergeEnvFile(path string, variables map[string]string) ([]string, error) {
	if path == "" {
		return nil, nil
	}
	values, err := readEnvFile(path)
	if err != nil {
		return nil, err
	}
	var merged []string
	for name, value := range values {
		if _, taken := variables[name]; !taken {
			variables[name] = value
			merged = append(merged, name)
		}
	}
	return merged, nil
}

func mergeSecretEnvFile(path string, variables map[string]string, secrets map[string]bool) error {
	merged, err := mergeEnvFile(path, variables)
	for _, name := range merged {
		secrets[name] = true
	}
	return err
}

func readEnvFile(path string) (map[string]string, error) {
	content, err := runner.ReadText(path)
	if err != nil {
		return nil, fmt.Errorf("cannot read the env file: %w", err)
	}
	values := map[string]string{}
	for _, text := range strings.Split(string(content), "\n") {
		line := strings.TrimSpace(text)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimSpace(strings.TrimPrefix(line, "export "))
		name, value, found := strings.Cut(line, "=")
		name = strings.TrimSpace(name)
		if !found || name == "" {
			return nil, fmt.Errorf("%s: write each line as KEY=value", path)
		}
		values[name] = unquote(strings.TrimSpace(value))
	}
	return values, nil
}
