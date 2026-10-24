package engine

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
)

type pair struct {
	key   string
	value string
}

var placeholderRe = regexp.MustCompile(`{{([^}]+)}}`)

var errTrailingJSON = errors.New("unexpected text after the JSON value")

func decodeJSON(raw string) (any, error) {
	dec := json.NewDecoder(strings.NewReader(raw))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return nil, err
	}
	if _, err := dec.Token(); err != io.EOF {
		return nil, errTrailingJSON
	}
	return v, nil
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

const maxNesting = 8

type substitution struct {
	variables map[string]string
	budget    int
	exceeded  bool
	files     FileReader
	read      map[string]string
	fileBytes int
	err       error
	filled    map[string]string
	filling   map[string]bool
	generates bool
	missing   []string
}

func newSubstitution(variables string) (*substitution, error) {
	parsed, err := parseVariables(variables)
	if err != nil {
		return nil, fmt.Errorf("environment variables are not valid JSON: %w", err)
	}
	return substitutionOf(parsed), nil
}

func substitutionOf(variables map[string]string) *substitution {
	return &substitution{variables: variables, budget: maxEncodedBody, filled: map[string]string{}, filling: map[string]bool{}, generates: true}
}

func (s *substitution) readingFiles(files FileReader) {
	s.files = files
	s.read = map[string]string{}
}

func (s *substitution) failure() error {
	if s.err != nil {
		return s.err
	}
	if s.exceeded {
		return fmt.Errorf("the request is larger than 10 MB once variables are filled in")
	}
	return nil
}

func (s *substitution) variable(name string) (string, string, bool) {
	if value, ok := s.variables[name]; ok {
		return name, value, true
	}
	if asked, isPrompt := PromptName(name); isPrompt {
		value, ok := s.variables[asked]
		return asked, value, ok
	}
	return "", "", false
}

func (s *substitution) resolve(name string) (string, bool) {
	key, value, ok := s.variable(name)
	if !ok {
		return "", false
	}
	return s.nested(key, value)
}

func (s *substitution) nested(name, value string) (string, bool) {
	if !placeholderRe.MatchString(value) {
		return value, true
	}
	if filled, ok := s.filled[name]; ok {
		return filled, true
	}
	if s.filling[name] || len(s.filling) >= maxNesting {
		return "", false
	}
	s.filling[name] = true
	defer delete(s.filling, name)
	if s.expandedSize(value, false) > maxEncodedBody {
		s.exceeded = true
		return "", false
	}
	filled := s.fill(value, false)
	s.filled[name] = filled
	return filled, true
}

func nameOf(match string) string {
	return strings.TrimSpace(match[2 : len(match)-2])
}

func (s *substitution) lookup(match string, readsFiles bool) (string, bool) {
	name := nameOf(match)
	if value, ok := s.resolve(name); ok {
		return value, true
	}
	if reference, ok := parseFileReference(name); ok {
		if !readsFiles {
			return "", false
		}
		return s.file(name, reference)
	}
	if !s.generates {
		return "", false
	}
	return dynamicValue(name)
}

func (s *substitution) file(name string, reference fileReference) (string, bool) {
	if s.files == nil {
		return "", false
	}
	if value, ok := s.read[name]; ok {
		return value, true
	}
	if s.exceeded || s.err != nil {
		return "", false
	}
	data, err := s.files(reference.path)
	if err != nil {
		s.err = err
		return "", false
	}
	s.fileBytes += len(data)
	if s.fileBytes > maxRequestBody {
		s.exceeded = true
		return "", false
	}
	value := reference.encode(data)
	s.read[name] = value
	return value, true
}

func (s *substitution) sizeOf(match string, readsFiles bool) (int, bool) {
	name := nameOf(match)
	if value, ok := s.resolve(name); ok {
		return len(value), true
	}
	if reference, ok := parseFileReference(name); ok {
		if !readsFiles {
			return 0, false
		}
		value, found := s.file(name, reference)
		return len(value), found
	}
	return generatedSizeBound(name), IsDynamicVariable(name)
}

func (s *substitution) expandedSize(input string, readsFiles bool) int {
	size := len(input)
	for _, match := range placeholderRe.FindAllString(input, -1) {
		if length, ok := s.sizeOf(match, readsFiles); ok {
			size += length - len(match)
		}
	}
	return size
}

func (s *substitution) fill(input string, readsFiles bool) string {
	return placeholderRe.ReplaceAllStringFunc(input, func(match string) string {
		if value, ok := s.lookup(match, readsFiles); ok {
			return value
		}
		s.noteMissing(nameOf(match))
		return match
	})
}

func (s *substitution) noteMissing(name string) {
	if s.isUndefined(name) && !slices.Contains(s.missing, name) {
		s.missing = append(s.missing, name)
	}
}

func (s *substitution) isUndefined(name string) bool {
	if name == "" || strings.HasPrefix(name, dynamicPrefix) {
		return false
	}
	if _, isPrompt := PromptName(name); isPrompt {
		return false
	}
	_, _, defined := s.variable(name)
	return !defined
}

func (s *substitution) apply(input string) string {
	if s.exceeded {
		return input
	}
	s.budget -= s.expandedSize(input, true)
	if s.budget < 0 {
		s.exceeded = true
		return input
	}
	return s.fill(input, true)
}

type pairRow struct {
	pair
	enabled bool
}

func parseRows(raw string) ([]pairRow, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	decoded, err := decodeJSON(raw)
	if err != nil {
		return nil, err
	}
	switch value := decoded.(type) {
	case map[string]any:
		return rowsFromPairs(pairsFromObject(value)), nil
	case []any:
		return rowsFromList(value), nil
	default:
		return nil, fmt.Errorf("expected a JSON object or a list of rows")
	}
}

func parsePairs(raw string) ([]pair, error) {
	rows, err := parseRows(raw)
	if err != nil {
		return nil, err
	}
	return enabledPairs(rows), nil
}

func rowsFromPairs(pairs []pair) []pairRow {
	rows := make([]pairRow, len(pairs))
	for i, entry := range pairs {
		rows[i] = pairRow{pair: entry, enabled: true}
	}
	return rows
}

func enabledPairs(rows []pairRow) []pair {
	var pairs []pair
	for _, entry := range rows {
		if entry.enabled {
			pairs = append(pairs, entry.pair)
		}
	}
	return pairs
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

func rowsFromList(items []any) []pairRow {
	var rows []pairRow
	for _, item := range items {
		fields, ok := item.(map[string]any)
		if !ok {
			continue
		}
		key := scalarString(fields["key"])
		if strings.TrimSpace(key) == "" {
			continue
		}
		rows = append(rows, pairRow{pair: pair{key, scalarString(fields["value"])}, enabled: fields["enabled"] != false})
	}
	return rows
}

func substitutePairs(pairs []pair, substitute func(string) string) []pair {
	out := make([]pair, len(pairs))
	for i, p := range pairs {
		out[i] = pair{substitute(p.key), substitute(p.value)}
	}
	return out
}
