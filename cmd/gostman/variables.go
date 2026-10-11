package main

import (
	"flag"
	"fmt"
	"os"
)

type fromEnvironment map[string]string

func (f fromEnvironment) String() string {
	return ""
}

func (f fromEnvironment) Set(name string) error {
	value, found := os.LookupEnv(name)
	if !found || name == "" {
		return fmt.Errorf("the environment variable %q is not set", name)
	}
	f[name] = value
	return nil
}

func variableFlags(flags *flag.FlagSet, variables map[string]string) {
	flags.Var(overrides(variables), "var", "")
	flags.Var(fromEnvironment(variables), "var-from-env", "")
}
