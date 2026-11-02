package main

import (
	"github.com/kunalgoesbyken/gostman/openapi"
	"github.com/kunalgoesbyken/gostman/openapi/diff"
)

func (a *App) DiffSpecs(query diff.Query) diff.Reply {
	return diff.Handle(a.ctx, query, openapi.Options{Policy: a.policy(), AllowFiles: true})
}
