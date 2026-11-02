package main

import (
	"context"
	"time"

	"github.com/kunalgoesbyken/gostman/openapi"
	"github.com/kunalgoesbyken/gostman/openapi/diff"
)

const diffTimeLimit = time.Minute

func (a *App) DiffSpecs(query diff.Query) diff.Reply {
	ctx, cancel := context.WithTimeout(a.ctx, diffTimeLimit)
	defer cancel()
	return diff.Handle(ctx, query, openapi.Options{Policy: a.policy(), AllowFiles: true})
}
