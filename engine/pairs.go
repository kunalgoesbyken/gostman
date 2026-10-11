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

type substitution struct {
	variables map[string]string
	budget    int
	exceeded  bool
}

func newSubstitution(variables string) (*substitution, error) {
	parsed, err := parseVariables(variables)
	if err != nil {
		return nil, fmt.Errorf("environment variables are not valid JSON: %w", err)
	}
	return &substitution{variables: parsed, budget: maxEncodedBody}, nil
}

func (s *substitution) overflow() error {
	if s.exceeded {
		return fmt.Errorf("the request is larger than 10 MB once variables are filled in")
	}
	return nil
}

func (s *substitution) lookup(match string) (string, bool) {
	value, ok := s.variables[strings.TrimSpace(match[2:len(match)-2])]
	return value, ok
}

func (s *substitution) expandedSize(input string) int {
	size := len(input)
	for _, match := range placeholderRe.FindAllString(input, -1) {
		if value, ok := s.lookup(match); ok {
			size += len(value) - len(match)
		}
	}
	return size
}

func (s *substitution) apply(input string) string {
	if s.exceeded || len(s.variables) == 0 {
		return input
	}
	s.budget -= s.expandedSize(input)
	if s.budget < 0 {
		s.exceeded = true
		return input
	}
	return placeholderRe.ReplaceAllStringFunc(input, func(match string) string {
		if value, ok := s.lookup(match); ok {
			return value
		}
		return match
	})
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
