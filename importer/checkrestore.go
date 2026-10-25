package importer

import (
	"slices"
	"strings"

	"github.com/dop251/goja/ast"
	"github.com/dop251/goja/parser"
)

const testSeparator = "\n\n"

func withoutCheckTests(target *scriptTarget, source string) (string, []assertion) {
	if target == nil {
		return source, nil
	}
	chunks := strings.Split(strings.TrimRight(source, "\n"), testSeparator)
	var rows []assertion
	kept := len(chunks)
	for ; kept > 0; kept-- {
		row, ok := checkRowOf(target, chunks[kept-1])
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

func checkRowOf(target *scriptTarget, chunk string) (assertion, bool) {
	title, ok := testTitle(chunk)
	if !ok {
		return assertion{}, false
	}
	for operator, rule := range checkRules {
		for _, row := range rowsTitled(title, operator, rule) {
			for _, enabled := range []bool{true, false} {
				row.Enabled = &enabled
				if code, problem := checkCode(target, row); problem == "" && code == chunk {
					return assertion{Expression: row.Expression, Operator: operator, Value: row.Value, Enabled: enabled}, true
				}
			}
		}
	}
	return assertion{}, false
}

func testTitle(chunk string) (string, bool) {
	program, err := parser.ParseFile(nil, "", chunk, 0)
	if err != nil || len(program.Body) != 1 {
		return "", false
	}
	statement, ok := program.Body[0].(*ast.ExpressionStatement)
	if !ok {
		return "", false
	}
	call, ok := statement.Expression.(*ast.CallExpression)
	if !ok || len(call.ArgumentList) != 2 {
		return "", false
	}
	callee, pure := chainOf(call.Callee)
	title, literal := call.ArgumentList[0].(*ast.StringLiteral)
	if !pure || !literal || callee.root != testFunction || len(callee.segments) > 1 {
		return "", false
	}
	return string(title.Value), true
}

func rowsTitled(title, operator string, rule checkRule) []checkRow {
	var rows []checkRow
	marker := " " + rule.label
	for at := strings.Index(title, marker); at > 0; at = nextIndex(title, marker, at) {
		rest := title[at+len(marker):]
		value, hasValue := strings.CutPrefix(rest, " ")
		switch {
		case rule.unary && rest == "":
			rows = append(rows, checkRow{Expression: title[:at], Operator: operator})
		case !rule.unary && hasValue:
			rows = append(rows, checkRow{Expression: title[:at], Operator: operator, Value: value})
		}
	}
	return rows
}

func nextIndex(text, marker string, after int) int {
	next := strings.Index(text[after+1:], marker)
	if next < 0 {
		return -1
	}
	return after + 1 + next
}
