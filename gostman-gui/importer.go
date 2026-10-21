package main

import (
	"github.com/krockxz/gostman/importer"
	"github.com/krockxz/gostman/openapi"
)

func (a *App) Import(query importer.Query) importer.Reply {
	return importer.Handle(a.ctx, query, importer.Config{OpenAPI: openapi.Options{Policy: a.policy()}})
}
