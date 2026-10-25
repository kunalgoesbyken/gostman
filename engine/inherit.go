package engine

import (
	"encoding/json"
	"strings"

	"github.com/kunalgoesbyken/gostman/locales"
)

const AuthInherit = "inherit"

type Layer struct {
	Headers string `json:"headers"`
	Auth    Auth   `json:"auth"`
}

type headerRow struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

func Resolve(r Request) (Request, error) {
	headers, auth, err := Inherit(r.Headers, r.Auth, r.Inherited)
	if err != nil {
		return r, err
	}
	r.Headers, r.Auth, r.Inherited = headers, auth, nil
	return r, nil
}

func Inherit(headers string, auth Auth, layers []Layer) (string, Auth, error) {
	resolved := InheritedAuth(auth, layers)
	if len(layers) == 0 {
		return headers, resolved, nil
	}
	merged, err := mergeHeaders(headers, layers)
	if err != nil {
		return "", resolved, err
	}
	return encodeHeaders(merged), resolved, nil
}

func InheritedAuth(own Auth, layers []Layer) Auth {
	if own.Type != AuthInherit {
		return own
	}
	for i := len(layers) - 1; i >= 0; i-- {
		if layers[i].Auth.Type != "" && layers[i].Auth.Type != AuthInherit {
			return layers[i].Auth
		}
	}
	return Auth{}
}

func mergeHeaders(own string, layers []Layer) ([]pair, error) {
	var merged []pair
	for _, source := range layerHeaders(own, layers) {
		rows, err := parseRows(source)
		if err != nil {
			return nil, locales.Wrap(locales.EngineRequestHeadersInvalid, nil, err)
		}
		merged = overlay(merged, rows)
	}
	return merged, nil
}

func layerHeaders(own string, layers []Layer) []string {
	sources := make([]string, 0, len(layers)+1)
	for _, layer := range layers {
		sources = append(sources, layer.Headers)
	}
	return append(sources, own)
}

func overlay(base []pair, rows []pairRow) []pair {
	named := make(map[string]bool, len(rows))
	for _, entry := range rows {
		named[strings.ToLower(entry.key)] = true
	}
	merged := make([]pair, 0, len(base)+len(rows))
	for _, entry := range base {
		if !named[strings.ToLower(entry.key)] {
			merged = append(merged, entry)
		}
	}
	return append(merged, enabledPairs(rows)...)
}

func encodeHeaders(pairs []pair) string {
	rows := make([]headerRow, len(pairs))
	for i, entry := range pairs {
		rows[i] = headerRow{Key: entry.key, Value: entry.value, Enabled: true}
	}
	encoded, _ := json.Marshal(rows)
	return string(encoded)
}
