package importer

import (
	"encoding/json"
	"math"
	"strconv"
	"strings"
)

const primitiveEquality = "const value = %s;\n  expect(typeof value === \"object\" && value !== null ? JSON.stringify(value) : String(value)).%s.equal(%s)"

const largestPlainNumber = 1e21

var numericFields = map[string]bool{"res.status": true, "res.responseTime": true, "res.size": true}

func (v checkValue) isNumber() bool {
	var parsed any
	if json.Unmarshal([]byte(v.raw), &parsed) != nil {
		return false
	}
	_, number := parsed.(float64)
	return number
}

func (v checkValue) primitiveText() (string, bool) {
	var parsed any
	if json.Unmarshal([]byte(v.raw), &parsed) != nil {
		return jsString(v.raw), true
	}
	switch value := parsed.(type) {
	case string:
		return jsString(value), true
	case bool, nil:
		return jsString(v.literal), true
	case float64:
		return numberText(value, v.literal), true
	}
	return "", false
}

func numberText(value float64, literal string) string {
	switch {
	case value == 0:
		return jsString("0")
	case math.Abs(value) < largestPlainNumber && (value == math.Trunc(value) || math.Abs(value) >= 1e-6):
		return jsString(strconv.FormatFloat(value, 'f', -1, 64))
	}
	return "String(" + literal + ")"
}

func sameInBruno(row checkRow) bool {
	if !row.enabled() {
		return true
	}
	switch row.operator() {
	case "eq", "neq":
		path, _ := checkExpression(row.Expression)
		return onlyTextMatches(row.Value) || (numericFields[path] && readCheckValue(row.Value).isNumber())
	}
	return true
}

func onlyTextMatches(raw string) bool {
	var parsed any
	if raw != strings.TrimSpace(raw) || strings.Contains(raw, placeholderStart) || json.Unmarshal([]byte(raw), &parsed) == nil {
		return false
	}
	if raw == "" || raw == "undefined" || quoted(raw) || strings.ContainsAny(raw, "`\\") || strings.Contains(raw, "${") {
		return false
	}
	_, isFloat := strconv.ParseFloat(raw, 64)
	_, isInteger := strconv.ParseInt(raw, 0, 64)
	return isFloat != nil && isInteger != nil
}

func quoted(raw string) bool {
	for _, mark := range []string{`"`, `'`} {
		if len(raw) > 1 && strings.HasPrefix(raw, mark) && strings.HasSuffix(raw, mark) {
			return true
		}
	}
	return false
}
