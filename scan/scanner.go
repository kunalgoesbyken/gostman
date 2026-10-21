package scan

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	base64Encoding = "base64"
	schemeMarker   = "://"
	userSeparator  = "@"
	passwordMarker = ":"
)

type site struct {
	kind      string
	path      string
	requestID string
}

type scanner struct {
	options  Options
	findings []Finding
	seen     map[string]bool
}

type exampleHeader struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type exampleRecord struct {
	Name         string          `json:"name"`
	Headers      []exampleHeader `json:"headers"`
	Body         string          `json:"body"`
	BodyEncoding string          `json:"bodyEncoding"`
}

func (s *scanner) examine(at site, field, value string, check judge) {
	found := detect(value)
	if len(found) == 0 && check != nil {
		found = check(value)
	}
	for _, hit := range found {
		s.add(at, field, hit)
	}
}

func (s *scanner) add(at site, field string, hit match) {
	finding := Finding{
		Location:    Location{Kind: at.kind, Path: at.path, Field: field, RequestID: at.requestID},
		Rule:        hit.ID,
		Severity:    hit.Severity,
		Preview:     mask(hit.value),
		Reason:      hit.Reason,
		Fingerprint: fingerprint(hit.value),
	}
	key := fmt.Sprintf("%s\x00%s\x00%s\x00%s\x00%s", at.kind, at.path, field, finding.Rule, finding.Fingerprint)
	if s.seen[key] {
		return
	}
	s.seen[key] = true
	s.findings = append(s.findings, finding)
}

func (s *scanner) rows(at site, label, raw string) {
	for _, entry := range parseRows(raw) {
		s.examine(at, labelled(label, entry.key), entry.value, named(entry.key))
	}
}

func (s *scanner) variables(at site, label, raw string) {
	s.mapped(at, label, parseObject(raw), nil)
}

func (s *scanner) mapped(at site, label string, object map[string]string, skip map[string]bool) {
	for _, entry := range rowsOf(object) {
		if !skip[entry.key] {
			s.examine(at, labelled(label, entry.key), entry.value, named(entry.key))
		}
	}
}

func (s *scanner) structured(at site, field, raw string) {
	if strings.TrimSpace(raw) == "" {
		return
	}
	parsed := walkJSON(raw, func(path, name, value string) {
		s.examine(at, jsonField(field, path), value, named(name))
	})
	if !parsed {
		s.examine(at, field, raw, nil)
	}
}

func jsonField(field, path string) string {
	if path == "" {
		return field
	}
	return labelled(field, path)
}

func (s *scanner) body(at site, bodyType, raw string) {
	if bodyType == engine.BodyForm || bodyType == engine.BodyMultipart {
		s.rows(at, "body", raw)
		return
	}
	s.structured(at, "body", raw)
}

func (s *scanner) address(at site, target string) {
	base, query, _ := strings.Cut(target, "?")
	s.credentials(at, base)
	s.examine(at, "url", base, nil)
	for _, pair := range queryPairs(query) {
		s.examine(at, labelled("query", pair.key), pair.value, named(pair.key))
	}
}

func (s *scanner) credentials(at site, base string) {
	_, rest, found := strings.Cut(base, schemeMarker)
	if !found {
		return
	}
	authority, _, _ := strings.Cut(rest, "/")
	separator := strings.LastIndex(authority, userSeparator)
	if separator < 0 {
		return
	}
	_, password, hasPassword := strings.Cut(authority[:separator], passwordMarker)
	if hasPassword {
		s.examine(at, "url credentials", password, literal(urlRule))
	}
}

func (s *scanner) scripts(at site, pre, post string) {
	s.examine(at, "pre-request script", pre, nil)
	s.examine(at, "post-response script", post, nil)
}

func (s *scanner) settings(at site, settings workspace.Settings) {
	s.rows(at, "header", settings.Headers)
	s.auth(at, settings.Auth)
	s.scripts(at, settings.PreScript, settings.PostScript)
}

func (s *scanner) examples(at site, raw string) {
	var records []exampleRecord
	if strings.TrimSpace(raw) == "" || json.Unmarshal([]byte(raw), &records) != nil {
		return
	}
	for index, record := range records {
		s.example(at, exampleLabel(record, index), record)
	}
}

func exampleLabel(record exampleRecord, index int) string {
	if record.Name != "" {
		return labelled("example", record.Name)
	}
	return labelled("example", fmt.Sprintf("#%d", index+1))
}

func (s *scanner) example(at site, label string, record exampleRecord) {
	for _, header := range record.Headers {
		s.examine(at, labelled(label+" header", header.Key), header.Value, named(header.Key))
	}
	if record.BodyEncoding != base64Encoding {
		s.structured(at, label+" body", record.Body)
	}
}
