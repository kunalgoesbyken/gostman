package main

import (
	"errors"
	"flag"
	"fmt"
	"strings"

	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/runner/report"
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

type runExtras struct {
	dataFile string
	envFile  string
}

func (e *runExtras) register(flags *flag.FlagSet, options *runner.Options) {
	flags.StringVar(&e.dataFile, "data", "", "")
	flags.IntVar(&options.Iterations, "iterations", 0, "")
	flags.IntVar(&options.Parallel, "parallel", 0, "")
	flags.StringVar(&e.envFile, "env-file", "", "")
	only := (*listFlag)(&options.Only)
	flags.Var(only, "only", "")
}

func (runExtras) validate(options runner.Options) error {
	if options.Iterations < 0 || options.Parallel < 0 {
		return errors.New("--iterations and --parallel take a number, zero or more")
	}
	return nil
}

func (e runExtras) apply(options *runner.Options, reporter string) error {
	if e.dataFile != "" {
		rows, err := runner.LoadData(e.dataFile)
		if err != nil {
			return err
		}
		options.Data = rows
	}
	if e.envFile != "" {
		values, err := readEnvFile(e.envFile)
		if err != nil {
			return err
		}
		for name, value := range values {
			if _, taken := options.Variables[name]; !taken {
				options.Variables[name] = value
			}
		}
	}
	options.Capture = reporter == report.FormatHTML
	return nil
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
