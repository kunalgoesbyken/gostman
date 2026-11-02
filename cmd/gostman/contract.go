package main

import (
	"context"
	"fmt"
	"os"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/importer"
	"github.com/kunalgoesbyken/gostman/openapi"
	"github.com/kunalgoesbyken/gostman/runner/report"
)

func loadContract(location string, network *engine.Network) (*openapi.Contract, error) {
	if location == "" {
		return nil, nil
	}
	document, err := openapi.Load(context.Background(), specSourceOf(location), openapi.Options{Policy: engine.Policy{Network: network}, AllowFiles: true})
	if err != nil {
		return nil, fmt.Errorf("--contract %s: %w", location, err)
	}
	if keys := document.IgnoredResponseKeys(); len(keys) > 0 {
		fmt.Fprintf(os.Stderr, "warning: %s\n", report.Printable(importer.IgnoredResponseKeysRemark(keys).English()))
	}
	contract := document.Contract()
	return &contract, nil
}
