package main

import "github.com/kunalgoesbyken/gostman/scan"

func (a *App) ScanSecrets(query scan.Query) scan.Reply {
	return scan.Handle(query)
}
