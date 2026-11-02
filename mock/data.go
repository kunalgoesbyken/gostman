package mock

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/runner"
)

const (
	FieldParam  = "param"
	maxDataRows = 100000
	rowScope    = "row."

	contentTypeJSON = "application/json"
)

var errDataUnavailable = errors.New("data files can be read only from an open workspace folder")

type DataLookup struct {
	File   string `json:"file"`
	Field  string `json:"field"`
	Name   string `json:"name"`
	Column string `json:"column"`
}

type dataset struct {
	lookup DataLookup
	rows   map[string]runner.Row
}

func (l DataLookup) validate() error {
	switch l.Field {
	case FieldParam, FieldQuery, FieldHeader, FieldBody:
	default:
		return fmt.Errorf("unknown data field %q", l.Field)
	}
	switch {
	case strings.TrimSpace(l.File) == "":
		return fmt.Errorf("a data rule needs a file")
	case strings.TrimSpace(l.Name) == "":
		return fmt.Errorf("a data rule needs the name of the %s to match", l.Field)
	case strings.TrimSpace(l.Column) == "":
		return fmt.Errorf("a data rule needs a column")
	case len(l.File) > maxConditionBytes || len(l.Name) > maxConditionBytes || len(l.Column) > maxConditionBytes:
		return fmt.Errorf("a data rule is limited to %d bytes per field", maxConditionBytes)
	}
	return nil
}

func (l DataLookup) load(files engine.FileReader) (*dataset, error) {
	if files == nil {
		return nil, errDataUnavailable
	}
	content, err := files(l.File)
	if err != nil {
		return nil, err
	}
	rows, err := runner.ParseData(l.File, content)
	if err != nil {
		return nil, err
	}
	if len(rows) > maxDataRows {
		return nil, fmt.Errorf("%s has %d rows; the mock server takes at most %d", l.File, len(rows), maxDataRows)
	}
	loaded := &dataset{lookup: l, rows: make(map[string]runner.Row, len(rows))}
	for _, row := range rows {
		key := rowText(row[l.Column])
		if _, taken := loaded.rows[key]; key != "" && !taken {
			loaded.rows[key] = row
		}
	}
	if _, present := rows[0][l.Column]; !present {
		return nil, fmt.Errorf("%s has no column %q", l.File, l.Column)
	}
	return loaded, nil
}

func (d *dataset) pick(e *exchange, params map[string]string) (runner.Row, bool) {
	key := d.observed(e, params)
	if key == "" {
		return nil, false
	}
	row, found := d.rows[key]
	return row, found
}

func (d *dataset) observed(e *exchange, params map[string]string) string {
	switch d.lookup.Field {
	case FieldParam:
		return params[d.lookup.Name]
	case FieldQuery:
		return e.query.Get(d.lookup.Name)
	case FieldHeader:
		return e.header.Get(d.lookup.Name)
	}
	return e.bodyValue(bodyJSON + stepSeparator + d.lookup.Name)
}

func rowText(raw json.RawMessage) string {
	var text string
	if json.Unmarshal(raw, &text) == nil {
		return text
	}
	if string(raw) == "null" {
		return ""
	}
	return string(raw)
}

func rowJSON(row runner.Row) []byte {
	encoded, err := json.Marshal(row)
	if err != nil {
		return []byte("{}")
	}
	return encoded
}
