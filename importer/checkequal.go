package importer

import (
	"encoding/json"
	"math"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/dop251/goja/ast"
)

const primitiveEquality = "const value = %s;\n  expect(typeof value === \"object\" && value !== null ? JSON.stringify(value) : String(value)).%s.equal(%s)"

const sizeOfValue = "(value !== null && typeof value === \"object\" && !Array.isArray(value) ? Object.keys(value).length : value?.length)"

const inclusion = "const value = %s;\n  const expected = %s;\n  const same = (item) => typeof item === \"object\" && item !== null || typeof expected === \"object\" && expected !== null ? JSON.stringify(item) === JSON.stringify(expected) : String(item) === String(expected);\n  expect(Array.isArray(value) ? value.some(same) : String(value).includes(String(expected))).to.be.%s"

const oneOfEquality = "const text = (item) => typeof item === \"object\" && item !== null ? JSON.stringify(item) : String(item);\n  expect(text(%s)).to.be.oneOf(%s)"

const (
	largestPlainNumber = 1e21
	maxSafeInteger     = 1<<53 - 1
)

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

var (
	brunoResponseFields = setOf("status", "body", "headers", "responseTime")
	brunoTypeChecks     = setOf("isNull", "isNumber", "isString", "isBoolean", "isArray")
	brunoPresenceChecks = setOf("neq", "isUndefined", "isDefined")
	missingForms        = []string{"undefined", "[object Object]"}
	nonTextForms        = append([]string{"true", "false", "null"}, missingForms...)
)

const numberCharacters = "0123456789.-+e"

func sameInBruno(row checkRow) bool {
	if !row.enabled() {
		return true
	}
	path, _ := checkExpression(row.Expression)
	field, depth, readable := brunoResponseMember(path)
	if !readable || brunoPresenceChecks[row.operator()] && !alwaysReached(field, depth) {
		return false
	}
	sameValue := func(raw string) bool {
		return onlyTextMatches(raw) || numericFields[path] && readCheckValue(raw).isNumber()
	}
	switch row.operator() {
	case "eq", "neq":
		return sameValue(row.Value)
	case "gt", "gte", "lt", "lte":
		return numericFields[path] && safeNumber(row.Value)
	case "in":
		return !strings.HasPrefix(strings.TrimSpace(row.Value), "[") && !slices.ContainsFunc(strings.Split(row.Value, ","), func(item string) bool { return !sameValue(strings.TrimSpace(item)) })
	case "contains":
		return onlyTextMatches(row.Value) && !onlyInNonText(row.Value)
	case "matches":
		return samePattern(row.Value)
	}
	return brunoTypeChecks[row.operator()] || brunoPresenceChecks[row.operator()]
}

func brunoResponseMember(path string) (string, int, bool) {
	expression, ok := soleExpression(path)
	field, depth, named := responseField(expression)
	return field, depth, ok && named && brunoResponseFields[field]
}

func alwaysReached(field string, depth int) bool {
	return depth == 1 || depth == 2 && field == "headers"
}

func responseField(expression ast.Expression) (string, int, bool) {
	var left, member ast.Expression
	switch node := expression.(type) {
	case *ast.DotExpression:
		left, member = node.Left, &ast.StringLiteral{Value: node.Identifier.Name}
	case *ast.BracketExpression:
		left, member = node.Left, node.Member
	default:
		return "", 0, false
	}
	if _, atRoot := left.(*ast.Identifier); !atRoot {
		field, depth, named := responseField(left)
		return field, depth + 1, named
	}
	name, literal := member.(*ast.StringLiteral)
	if !literal {
		return "", 0, false
	}
	return string(name.Value), 1, true
}

func safeNumber(raw string) bool {
	var parsed any
	if json.Unmarshal([]byte(raw), &parsed) != nil {
		return false
	}
	number, isNumber := parsed.(float64)
	return isNumber && math.Abs(number) <= maxSafeInteger
}

func onlyInNonText(raw string) bool {
	if strings.Trim(raw, numberCharacters) == "" {
		return true
	}
	return slices.ContainsFunc(nonTextForms, func(form string) bool { return strings.Contains(form, raw) })
}

func samePattern(raw string) bool {
	var parsed any
	if !onlyPatternText(raw) || json.Unmarshal([]byte(raw), &parsed) == nil {
		return false
	}
	pattern, err := regexp.Compile(raw)
	return err == nil && !slices.ContainsFunc(missingForms, pattern.MatchString)
}

func onlyPatternText(raw string) bool {
	slashed := strings.HasPrefix(raw, "/") && strings.HasSuffix(raw, "/")
	return raw != "" && raw == strings.TrimSpace(raw) && !slashed && !strings.Contains(raw, placeholderStart)
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
