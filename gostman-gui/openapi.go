package main

import "github.com/kunalgoesbyken/gostman/openapi"

func (a *App) OpenAPI(query openapi.Query) openapi.Reply {
	return openapi.Handle(a.ctx, query, openapi.Options{Policy: a.policy(), AllowFiles: true})
}
