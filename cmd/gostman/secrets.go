package main

import (
	"flag"
	"os"

	"github.com/krockxz/gostman/runner"
	"github.com/krockxz/gostman/secrets"
)

type secretsFile struct{}

func (secretsFile) String() string {
	return ""
}

func (secretsFile) Set(path string) error {
	values, err := readEnvFile(path)
	if err != nil {
		return err
	}
	useSecretEnvironment(func(name string) (string, bool) {
		if value, found := os.LookupEnv(name); found && value != "" {
			return value, true
		}
		value, found := values[name]
		return value, found
	})
	return nil
}

func useSecretEnvironment(lookup secrets.Environment) {
	runner.UseResolver(secrets.NewResolver(lookup.Lookup()))
}

func secretFlags(flags *flag.FlagSet) {
	flags.BoolFunc("secrets", "", func(string) error {
		useSecretEnvironment(os.LookupEnv)
		return nil
	})
	flags.Var(secretsFile{}, "secrets-env-file", "")
}
