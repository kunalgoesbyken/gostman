package main

import (
	"context"
	"net/url"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/mock"
	"github.com/kunalgoesbyken/gostman/openapi"
)

func specSourceOf(location string) openapi.Source {
	parsed, err := url.Parse(location)
	if err == nil && (parsed.Scheme == "http" || parsed.Scheme == "https") {
		return openapi.Source{URL: location}
	}
	return openapi.Source{Path: location}
}

func loadSpec(location string) (mock.Spec, error) {
	return mock.FromSpec(context.Background(), specSourceOf(location), openapi.Options{Policy: engine.Policy{}, AllowFiles: true})
}
