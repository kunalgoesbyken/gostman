package main

import (
	"encoding/json"
	"path/filepath"

	"github.com/kunalgoesbyken/gostman/engine"
)

const cookiesFileName = "cookies.json"

var cookiesSection = section{
	key:     "cookies",
	path:    filepath.Join(appFolder, cookiesFileName),
	carried: func(carried carriedSections) json.RawMessage { return carried.Cookies },
}

func (a *App) SaveCookies(cookies []engine.CookieInfo) error {
	return saveSection(cookiesSection, cookies)
}
