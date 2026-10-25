package importer

import (
	"fmt"
	"slices"
	"strings"
)

const brunoExpected = `((text) => {
    const trimmed = String(text).trim();
    if (trimmed === "") return text;
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    if (trimmed === "undefined") return undefined;
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1);
    if (!isNaN(trimmed)) return Number(trimmed) > Number.MAX_SAFE_INTEGER ? trimmed : Number(trimmed);
    return trimmed;
  })`

const newline = "\n"

const brunoJSON = `typeof value === "object" && value !== null && (Array.isArray(value) || Object.prototype.toString.call(value) === "[object Object]")`

var (
	brunoUnaryOperators = setOf("isEmpty", "isNotEmpty", "isNull", "isUndefined", "isDefined", "isTruthy", "isFalsy", "isJson", "isNumber", "isString", "isBoolean", "isArray")
	brunoValueOperators = setOf("eq", "neq", "gt", "gte", "lt", "lte", "in", "notIn", "contains", "notContains", "length", "matches", "notMatches", "startsWith", "endsWith", "between")
	brunoAssertions     = map[string]string{
		"eq": "expect(value).to.equal(%s)", "neq": "expect(value).to.not.equal(%s)",
		"gt": "expect(value).to.be.above(%s)", "gte": "expect(value).to.be.at.least(%s)",
		"lt": "expect(value).to.be.below(%s)", "lte": "expect(value).to.be.at.most(%s)",
		"in": "expect(value).to.be.oneOf(%s)", "notIn": "expect(value).to.not.be.oneOf(%s)",
		"contains": "expect(value).to.include(%s)", "notContains": "expect(value).to.not.include(%s)",
		"length":     "expect(value).to.have.lengthOf(%s)",
		"matches":    "expect(value !== undefined && new RegExp(%s).test(value)).to.be.true",
		"notMatches": "expect(value !== undefined && new RegExp(%s).test(value)).to.be.false",
		"startsWith": "const expected = %s;\n  expect(typeof value === \"string\" && typeof expected === \"string\" && value.startsWith(expected)).to.be.true",
		"endsWith":   "const expected = %s;\n  expect(typeof value === \"string\" && typeof expected === \"string\" && value.endsWith(expected)).to.be.true",
		"between":    "expect(value).to.be.within(...%s)",
		"isEmpty":    "expect(value).to.be.empty", "isNotEmpty": "expect(value).to.not.be.empty",
		"isNull": "expect(value).to.be.null", "isUndefined": "expect(value).to.be.undefined", "isDefined": "expect(value).to.not.be.undefined",
		"isTruthy": "expect(value).to.be.true", "isFalsy": "expect(value).to.be.false", "isJson": "expect(" + brunoJSON + ").to.be.true",
		"isNumber": `expect(value).to.be.a("number")`, "isString": `expect(value).to.be.a("string")`,
		"isBoolean": `expect(value).to.be.a("boolean")`, "isArray": `expect(value).to.be.a("array")`,
	}
)

type brunoCheck struct {
	expression string
	written    string
	operator   string
	value      string
	enabled    bool
}

func readBrunoCheck(expression, written string, enabled bool) brunoCheck {
	check := brunoCheck{expression: strings.TrimSpace(expression), written: strings.TrimSpace(written), enabled: enabled}
	operator, value, _ := strings.Cut(check.written, " ")
	switch {
	case brunoUnaryOperators[operator]:
		check.operator = operator
	case brunoValueOperators[operator]:
		check.operator, check.value = operator, value
	default:
		check.operator, check.value = "eq", check.written
	}
	return check
}

func (c *collector) brunoChecks(d *dialect, label string, checks []brunoCheck) ([]assertion, string) {
	var rows []assertion
	var tests []string
	for _, check := range checks {
		row, kept := check.row()
		switch {
		case kept:
			rows = append(rows, row)
		case check.enabled:
			tests = append(tests, check.test())
			c.scripts.checks++
		default:
			c.skip(messageAssertOff, label, check.expression+": "+check.written)
		}
	}
	return rows, c.translateStripped(d, label, stageChecks, strings.Join(tests, testSeparator))
}

func (check brunoCheck) row() (assertion, bool) {
	operator, known := brunoAssertOperators[check.operator]
	value := strings.TrimSpace(check.value)
	same := known && sameInBruno(checkRow{Expression: check.expression, Operator: operator, Value: value, Enabled: &check.enabled})
	return assertion{Expression: check.expression, Operator: operator, Value: value, Enabled: check.enabled}, same
}

func (check brunoCheck) test() string {
	lines := []string{"const value = " + check.expression + ";"}
	assertion := brunoAssertions[check.operator]
	if !brunoUnaryOperators[check.operator] {
		lines = append(lines, "const read = "+brunoExpected+";")
		assertion = fmt.Sprintf(assertion, check.expected())
	}
	lines = append(lines, assertion+";")
	return testFunction + "(" + jsString(check.expression+": "+check.written) + ", () => {" + newline + "  " + strings.Join(lines, newline+"  ") + newline + "});"
}

func brunoRowsIn(source string) (string, []assertion) {
	chunks := strings.Split(strings.TrimRight(source, newline), testSeparator)
	var rows []assertion
	kept := len(chunks)
	for ; kept > 0; kept-- {
		row, ok := brunoRowOf(chunks[kept-1])
		if !ok {
			break
		}
		rows = append(rows, row)
	}
	if len(rows) == 0 {
		return source, nil
	}
	slices.Reverse(rows)
	return strings.Join(chunks[:kept], testSeparator), rows
}

func brunoRowOf(chunk string) (assertion, bool) {
	title, ok := testTitle(chunk)
	if !ok {
		return assertion{}, false
	}
	expression, written, found := strings.Cut(title, ": ")
	if !found {
		return assertion{}, false
	}
	check := readBrunoCheck(expression, written, true)
	if check.test() != chunk {
		return assertion{}, false
	}
	return assertion{Expression: check.expression, Operator: check.operator, Value: check.value, Enabled: true}, true
}

func isBrunoWritable(operator string) bool {
	_, known := brunoAssertOperators[operator]
	return known || brunoUnaryOperators[operator] || brunoValueOperators[operator]
}

func (check brunoCheck) expected() string {
	switch check.operator {
	case "in", "notIn", "between":
		items := strings.Split(withoutEnds(check.value, "[", "]"), ",")
		for index, item := range items {
			items[index] = brunoValue(strings.TrimSpace(item))
		}
		return "[" + strings.Join(items, ", ") + "]"
	case "matches", "notMatches":
		return interpolated(withoutEnds(check.value, "/", "/"))
	}
	return brunoValue(check.value)
}

func withoutEnds(text, open, close string) string {
	if len(text) < 2 || !strings.HasPrefix(text, open) || !strings.HasSuffix(text, close) {
		return text
	}
	return text[1 : len(text)-1]
}

func brunoValue(raw string) string {
	return "read(" + interpolated(raw) + ")"
}

func interpolated(raw string) string {
	return "env.interpolate(" + jsString(raw) + ")"
}
