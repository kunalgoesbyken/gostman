package importer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/dop251/goja/ast"
	"github.com/dop251/goja/parser"
)

const (
	placeholderStart = "{{"
	checkRoot        = "res"
	pathRootPrefix   = "$."
	testFunction     = "test"
)

type checkRow struct {
	Expression string `json:"expression"`
	Operator   string `json:"operator"`
	Value      string `json:"value"`
	Enabled    *bool  `json:"enabled"`
}

type checkRule struct {
	label string
	unary bool
	code  func(actual string, expected checkValue) string
}

type checkValue struct {
	raw         string
	literal     string
	placeholder bool
}

var checkRules = map[string]checkRule{
	"eq":          {label: "equals", code: equalCheck("to")},
	"neq":         {label: "does not equal", code: equalCheck("to.not")},
	"gt":          {label: "is greater than", code: numberCheck("above")},
	"gte":         {label: "is at least", code: numberCheck("at.least")},
	"lt":          {label: "is less than", code: numberCheck("below")},
	"lte":         {label: "is at most", code: numberCheck("at.most")},
	"contains":    {label: "contains", code: valueCheck("to.include")},
	"notContains": {label: "does not contain", code: valueCheck("to.not.include")},
	"startsWith":  {label: "starts with", code: textCheck("startsWith")},
	"endsWith":    {label: "ends with", code: textCheck("endsWith")},
	"matches": {label: "matches regex", code: func(actual string, expected checkValue) string {
		return fmt.Sprintf("expect(String(%s)).to.match(new RegExp(%s))", actual, expected.text())
	}},
	"in":          {label: "is one of", code: oneOfCheck},
	"length":      {label: "has length", code: valueCheck("to.have.lengthOf")},
	"isDefined":   {label: "is defined", unary: true, code: unaryCheck("to.not.be.undefined")},
	"isUndefined": {label: "is undefined", unary: true, code: unaryCheck("to.be.undefined")},
	"isNull":      {label: "is null", unary: true, code: unaryCheck("to.be.null")},
	"isEmpty":     {label: "is empty", unary: true, code: unaryCheck("to.be.empty")},
	"isNotEmpty":  {label: "is not empty", unary: true, code: unaryCheck("to.not.be.empty")},
	"isTrue":      {label: "is true", unary: true, code: unaryCheck("to.be.true")},
	"isFalse":     {label: "is false", unary: true, code: unaryCheck("to.be.false")},
	"isNumber":    {label: "is a number", unary: true, code: unaryCheck(`to.be.a("number")`)},
	"isString":    {label: "is a string", unary: true, code: unaryCheck(`to.be.a("string")`)},
	"isBoolean":   {label: "is a boolean", unary: true, code: unaryCheck(`to.be.a("boolean")`)},
	"isArray":     {label: "is an array", unary: true, code: unaryCheck(`to.be.an("array")`)},
	"isObject":    {label: "is an object", unary: true, code: unaryCheck(`to.be.an("object")`)},
	schemaCheck:   {label: "matches schema", unary: true},
}

const schemaCheck = "schema"

func jsString(text string) string {
	var out bytes.Buffer
	encoder := json.NewEncoder(&out)
	encoder.SetEscapeHTML(false)
	_ = encoder.Encode(text)
	return strings.TrimSuffix(out.String(), "\n")
}

func readCheckValue(raw string) checkValue {
	if strings.Contains(raw, placeholderStart) {
		return checkValue{raw: raw, literal: "env.interpolate(" + jsString(raw) + ")", placeholder: true}
	}
	trimmed := strings.TrimSpace(raw)
	var compact bytes.Buffer
	if trimmed != "" && json.Compact(&compact, []byte(trimmed)) == nil {
		return checkValue{raw: raw, literal: compact.String()}
	}
	return checkValue{raw: raw, literal: jsString(raw)}
}

func (v checkValue) text() string {
	if v.placeholder || strings.HasPrefix(v.literal, `"`) {
		return v.literal
	}
	return jsString(v.raw)
}

func (v checkValue) number() string {
	if v.placeholder {
		return "Number(" + v.literal + ")"
	}
	return v.literal
}

func equalCheck(chainText string) func(string, checkValue) string {
	return func(actual string, expected checkValue) string {
		if expected.placeholder {
			return fmt.Sprintf("expect(String(%s)).%s.equal(%s)", actual, chainText, expected.literal)
		}
		if numericFields[actual] && expected.isNumber() {
			return fmt.Sprintf("expect(%s).%s.equal(%s)", actual, chainText, expected.literal)
		}
		if text, primitive := expected.primitiveText(); primitive {
			return fmt.Sprintf(primitiveEquality, actual, chainText, text)
		}
		return fmt.Sprintf("expect(JSON.stringify(%s)).%s.equal(JSON.stringify(%s))", actual, chainText, expected.literal)
	}
}

func numberCheck(method string) func(string, checkValue) string {
	return func(actual string, expected checkValue) string {
		return fmt.Sprintf("expect(Number(%s)).to.be.%s(%s)", actual, method, expected.number())
	}
}

func valueCheck(chainText string) func(string, checkValue) string {
	return func(actual string, expected checkValue) string {
		return fmt.Sprintf("expect(%s).%s(%s)", actual, chainText, expected.literal)
	}
}

func textCheck(method string) func(string, checkValue) string {
	return func(actual string, expected checkValue) string {
		return fmt.Sprintf("expect(%s).to.satisfy((value) => String(value).%s(%s))", actual, method, expected.text())
	}
}

func unaryCheck(chainText string) func(string, checkValue) string {
	return func(actual string, _ checkValue) string {
		return fmt.Sprintf("expect(%s).%s", actual, chainText)
	}
}

func oneOfCheck(actual string, expected checkValue) string {
	if expected.placeholder {
		return fmt.Sprintf("expect(String(%s)).to.be.oneOf(%s.split(\",\").map((item) => item.trim()))", actual, expected.literal)
	}
	if strings.HasPrefix(expected.literal, "[") {
		return fmt.Sprintf("expect(%s).to.be.oneOf(%s)", actual, expected.literal)
	}
	var items []string
	for _, item := range strings.Split(expected.raw, ",") {
		items = append(items, readCheckValue(strings.TrimSpace(item)).literal)
	}
	return fmt.Sprintf("expect(%s).to.be.oneOf([%s])", actual, strings.Join(items, ", "))
}

func readChecks(source string) []checkRow {
	var rows []checkRow
	if json.Unmarshal([]byte(source), &rows) != nil {
		return nil
	}
	return rows
}

func (row checkRow) enabled() bool {
	return row.Enabled == nil || *row.Enabled
}

func (row checkRow) operator() string {
	if row.Operator == "" {
		return "eq"
	}
	return row.Operator
}

func (row checkRow) title() string {
	rule, known := checkRules[row.operator()]
	label := row.operator()
	if known {
		label = rule.label
	}
	parts := []string{strings.TrimSpace(row.Expression), label}
	if !rule.unary {
		parts = append(parts, row.Value)
	}
	return strings.Join(parts, " ")
}

func checkExpression(expression string) (string, bool) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(expression), pathRootPrefix)
	program, err := parser.ParseFile(nil, "", trimmed, 0)
	if err != nil || len(program.Body) != 1 {
		return "", false
	}
	statement, ok := program.Body[0].(*ast.ExpressionStatement)
	if !ok || !isMemberPath(statement.Expression, checkRoot) {
		return "", false
	}
	return trimmed, true
}

func isMemberPath(expression ast.Expression, root string) bool {
	switch node := expression.(type) {
	case *ast.Identifier:
		return string(node.Name) == root
	case *ast.DotExpression:
		return isMemberPath(node.Left, root)
	case *ast.BracketExpression:
		switch node.Member.(type) {
		case *ast.StringLiteral, *ast.NumberLiteral:
			return isMemberPath(node.Left, root)
		}
	}
	return false
}

func checkCode(target *scriptTarget, row checkRow) (string, string) {
	rule, known := checkRules[row.operator()]
	if !known {
		return "", fmt.Sprintf(messageExportCheckOperator, row.operator())
	}
	actual, ok := checkExpression(row.Expression)
	if !ok {
		return "", fmt.Sprintf(messageExportCheckPath, strings.TrimSpace(row.Expression), target.name)
	}
	expected := readCheckValue(row.Value)
	assertion := ""
	if row.operator() == schemaCheck {
		schema := expected.literal
		if expected.placeholder {
			schema = "JSON.parse(" + expected.literal + ")"
		}
		assertion = target.schema(actual, schema)
	} else {
		assertion = rule.code(actual, expected)
	}
	return fmt.Sprintf("%s(%s, () => {\n  %s;\n});", testCallee(row), jsString(row.title()), assertion), ""
}

func testCallee(row checkRow) string {
	if row.enabled() {
		return testFunction
	}
	return testFunction + ".skip"
}
