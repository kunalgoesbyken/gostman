package agent

import (
	"encoding/json"
	"slices"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/runner"
)

const (
	headerKeyField   = "key"
	headerValueField = "value"
)

func isCredentialRow(row map[string]any) bool {
	name, _ := row[headerKeyField].(string)
	value, _ := row[headerValueField].(string)
	return (isCredentialHeader(name) || redact.IsSensitiveName(name)) && isLiteral(value)
}

func withoutLiteralHeaders(raw string) (string, []string) {
	var rows []map[string]any
	if json.Unmarshal([]byte(raw), &rows) != nil {
		return raw, nil
	}
	var dropped []string
	kept := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		if isCredentialRow(row) {
			name, _ := row[headerKeyField].(string)
			dropped = append(dropped, strings.TrimPrefix(headerLabel(name), hiddenPrefix))
			continue
		}
		kept = append(kept, row)
	}
	if len(dropped) == 0 {
		return raw, nil
	}
	encoded, err := json.Marshal(kept)
	if err != nil {
		return raw, nil
	}
	return string(encoded), dropped
}

func withoutLiteralAuth(auth engine.Auth) (engine.Auth, []string) {
	var dropped []string
	for _, field := range authFields(&auth) {
		if isLiteral(*field.value) {
			*field.value = ""
			dropped = append(dropped, strings.TrimPrefix(field.label, hiddenPrefix))
		}
	}
	return auth, dropped
}

func withoutLiterals(request runner.Request) (runner.Request, []string) {
	var dropped []string
	var found []string
	request.Headers, found = withoutLiteralHeaders(request.Headers)
	dropped = append(dropped, found...)
	request.Auth, found = withoutLiteralAuth(request.Auth)
	dropped = append(dropped, found...)
	request.Lineage = slices.Clone(request.Lineage)
	for index := range request.Lineage {
		request.Lineage[index].Headers, found = withoutLiteralHeaders(request.Lineage[index].Headers)
		dropped = append(dropped, found...)
		request.Lineage[index].Auth, found = withoutLiteralAuth(request.Lineage[index].Auth)
		dropped = append(dropped, found...)
	}
	return request, slices.Compact(sorted(dropped))
}

func (s secretScope) Vet(request runner.Request) (runner.Request, []string) {
	if request.ID == "" || !s.reach.authored(request.ID) {
		return request, nil
	}
	return withoutLiterals(request)
}

func (d *destinations) authored(id string) bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.survey.authored[id]
}
