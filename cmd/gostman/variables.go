package main

import (
	"flag"
	"fmt"
	"os"
)

type fromEnvironment struct {
	values map[string]string
	names  map[string]bool
}

func (f fromEnvironment) String() string {
	return ""
}

func (f fromEnvironment) Set(name string) error {
	value, found := os.LookupEnv(name)
	if !found || name == "" {
		return fmt.Errorf("the environment variable %q is not set", name)
	}
	f.values[name] = value
	f.names[name] = true
	return nil
}

func variableFlags(flags *flag.FlagSet, variables map[string]string) map[string]bool {
	fromEnv := fromEnvironment{values: variables, names: map[string]bool{}}
	flags.Var(overrides(variables), "var", "")
	flags.Var(fromEnv, "var-from-env", "")
	secretFlags(flags)
	return fromEnv.names
}
