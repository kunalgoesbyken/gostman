package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/kunalgoesbyken/gostman/engine"
)

type signInFlags struct {
	accessEnv  string
	refreshEnv string
}

func (s *signInFlags) register(flags *flag.FlagSet) {
	flags.StringVar(&s.accessEnv, "oauth-token-env", "", "")
	flags.StringVar(&s.refreshEnv, "oauth-refresh-token-env", "", "")
}

func tokenFromEnv(flagName, variable string) (string, error) {
	if variable == "" {
		return "", nil
	}
	value := os.Getenv(variable)
	if value == "" {
		return "", fmt.Errorf("--%s names %s, which is not set", flagName, variable)
	}
	return value, nil
}

func (s signInFlags) token() (engine.Token, error) {
	access, err := tokenFromEnv("oauth-token-env", s.accessEnv)
	if err != nil {
		return engine.Token{}, err
	}
	refresh, err := tokenFromEnv("oauth-refresh-token-env", s.refreshEnv)
	return engine.Token{AccessToken: access, RefreshToken: refresh}, err
}
