package main

import (
	"context"
	"fmt"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/openapi"
)

func loadContract(location string, network *engine.Network) (*openapi.Contract, error) {
	if location == "" {
		return nil, nil
	}
	document, err := openapi.Load(context.Background(), specSourceOf(location), openapi.Options{Policy: engine.Policy{Network: network}, AllowFiles: true})
	if err != nil {
		return nil, fmt.Errorf("--contract %s: %w", location, err)
	}
	contract := document.Contract()
	return &contract, nil
}
