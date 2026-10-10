package engine

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

type pair struct {
	key   string
	value string
}

var placeholderRe = regexp.MustCompile(`{{([^}]+)}}`)

func decodeJSON(raw string) (any, error) {
	dec := json.NewDecoder(strings.NewReader(raw))
	dec.UseNumber()
	var v any
	err := dec.Decode(&v)
	return v, err
}

func scalarString(v any) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	case json.Number:
		return t.String()
	case bool:
		return strconv.FormatBool(t)
	default:
		encoded, _ := json.Marshal(t)
		return string(encoded)
	}
}

func parseVariables(raw string) (map[string]string, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	decoded, err := decodeJSON(raw)
	if err != nil {
		return nil, err
	}
	object, ok := decoded.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("expected a JSON object")
	}
	variables := make(map[string]string, len(object))
	for key, value := range object {
		if value != nil {
			variables[key] = scalarString(value)
		}
	}
	return variables, nil
}

func substituter(variables map[string]string) func(string) string {
	return func(input string) string {
		return placeholderRe.ReplaceAllStringFunc(input, func(match string) string {
			key := strings.TrimSpace(match[2 : len(match)-2])
			if value, ok := variables[key]; ok {
				return value
			}
			return match
		})
	}
}

func parsePairs(raw string) ([]pair, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	decoded, err := decodeJSON(raw)
	if err != nil {
		return nil, err
	}
	switch value := decoded.(type) {
	case map[string]any:
		return pairsFromObject(value), nil
	case []any:
		return pairsFromRows(value), nil
	default:
		return nil, fmt.Errorf("expected a JSON object or a list of rows")
	}
}

func pairsFromObject(object map[string]any) []pair {
	keys := make([]string, 0, len(object))
	for key := range object {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	var pairs []pair
	for _, key := range keys {
		if values, ok := object[key].([]any); ok {
			for _, value := range values {
				pairs = append(pairs, pair{key, scalarString(value)})
			}
			continue
		}
		pairs = append(pairs, pair{key, scalarString(object[key])})
	}
	return pairs
}

func pairsFromRows(rows []any) []pair {
	var pairs []pair
	for _, row := range rows {
		fields, ok := row.(map[string]any)
		if !ok || fields["enabled"] == false {
			continue
		}
		key := scalarString(fields["key"])
		if strings.TrimSpace(key) == "" {
			continue
		}
		pairs = append(pairs, pair{key, scalarString(fields["value"])})
	}
	return pairs
}

func substitutePairs(pairs []pair, substitute func(string) string) []pair {
	out := make([]pair, len(pairs))
	for i, p := range pairs {
		out[i] = pair{substitute(p.key), substitute(p.value)}
	}
	return out
}
