package main

import (
	_ "embed"
	"encoding/json"

	"github.com/kunalgoesbyken/gostman/engine"
)

//go:embed wails.json
var wailsConfig []byte

var currentVersion = productVersion(wailsConfig)

func init() {
	engine.ProductVersion = currentVersion
}

func productVersion(config []byte) string {
	var parsed struct {
		Info struct {
			ProductVersion string `json:"productVersion"`
		} `json:"info"`
	}
	if json.Unmarshal(config, &parsed) != nil {
		return ""
	}
	return parsed.Info.ProductVersion
}
