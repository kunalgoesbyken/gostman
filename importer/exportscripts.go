package importer

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	stageChecks  = "checks"
	stageExtract = "Extract tab"
)

type Report struct {
	Notes    []string `json:"notes,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
}

type scriptExport struct {
	target    *scriptTarget
	unchanged int
	adapted   int
	defined   map[string]bool
	checks    int
	kept      int
	skipped   int
	warnings  []string
	tests     map[string]string

	skippedTests   int
	extractLines   int
	extractVars    int
	extractSkipped int
}

type exportPlace struct {
	id    string
	label string
}

func targetFor(format string) *scriptTarget {
	switch format {
	case TargetPostman:
		return postmanTarget
	case TargetBruno:
		return brunoTarget
	}
	return nil
}

func AdaptScripts(format string, collection workspace.Collection) (workspace.Collection, Report, error) {
	target := targetFor(format)
	if target == nil {
		return collection, Report{}, fmt.Errorf(messageExportTarget, format)
	}
	adapted, export := adaptCollection(target, collection)
	return adapted, export.report(), nil
}

func adaptCollection(target *scriptTarget, collection workspace.Collection) (workspace.Collection, *scriptExport) {
	export := &scriptExport{target: target, defined: map[string]bool{}, tests: map[string]string{}}
	adapted := collection
	adapted.Requests = make([]workspace.Request, len(collection.Requests))
	for index, request := range collection.Requests {
		place := exportPlace{id: request.Id, label: fmt.Sprintf(labelRequest, request.Name)}
		request.PreScript = export.script(place, stagePre, request.PreScript, true)
		extract, vars := export.extractRules(place, request.Extractors)
		request.PostScript, request.Assertions = export.scriptWithChecks(place, extract, request.PostScript, request.Assertions, target.assertRows)
		request.Extractors = vars
		adapted.Requests[index] = request
	}
	adapted.Folders = make([]workspace.Folder, len(collection.Folders))
	for index, folder := range collection.Folders {
		folder.Settings = export.settings(exportPlace{id: folder.Id, label: fmt.Sprintf(labelFolder, folder.Name)}, folder.Settings)
		adapted.Folders[index] = folder
	}
	adapted.Settings = export.settings(exportPlace{label: fmt.Sprintf(labelCollection, exportName)}, collection.Settings)
	return adapted, export
}

func (e *scriptExport) settings(place exportPlace, settings workspace.Settings) workspace.Settings {
	settings.PreScript = e.script(place, stagePre, settings.PreScript, true)
	settings.PostScript, settings.Assertions = e.scriptWithChecks(place, "", settings.PostScript, settings.Assertions, false)
	return settings
}

func (e *scriptExport) script(place exportPlace, stage, source string, counted bool) string {
	if strings.TrimSpace(source) == "" {
		return source
	}
	adapted := adaptScript(e.target, source)
	switch {
	case adapted.unread:
		e.warn(place, stage, 0, messageExportUnread)
	case !counted:
	case len(adapted.defined) > 0:
		e.adapted++
		for _, name := range adapted.defined {
			e.defined[name] = true
		}
	case len(adapted.notes) == 0:
		e.unchanged++
	}
	for _, note := range adapted.notes {
		e.warn(place, stage, note.line, note.text)
	}
	return adapted.text
}

func (e *scriptExport) scriptWithChecks(place exportPlace, extract, source, checks string, keepNative bool) (string, string) {
	var kept []assertion
	var tests []string
	for _, row := range readChecks(checks) {
		if strings.TrimSpace(row.Expression) == "" {
			continue
		}
		if path, plain := checkExpression(row.Expression); keepNative && plain && isBrunoOperator(row) && sameInBruno(row) {
			kept = append(kept, assertion{Expression: path, Operator: row.operator(), Value: row.Value, Enabled: row.enabled()})
			e.kept++
			continue
		}
		if !row.enabled() && e.target.assertRows {
			e.skipped++
			continue
		}
		code, problem := checkCode(e.target, row)
		if problem != "" {
			e.warn(place, stageChecks, 0, fmt.Sprintf(messageExportCheckLeft, row.title(), problem))
			continue
		}
		if !row.enabled() {
			e.skippedTests++
		} else {
			e.checks++
		}
		tests = append(tests, code)
	}
	generated := strings.Join(tests, "\n\n")
	if e.target.assertRows {
		e.tests[place.id] = e.script(place, stageChecks, generated, false)
		return e.script(place, stageAfter, joinScripts([]string{extract, source}), strings.TrimSpace(source) != ""), encodeChecks(kept)
	}
	return e.script(place, stageAfter, joinScripts([]string{extract, source, generated}), strings.TrimSpace(source) != ""), ""
}

func isBrunoOperator(row checkRow) bool {
	_, known := brunoAssertOperators[row.operator()]
	return known
}

func encodeChecks(rows []assertion) string {
	if len(rows) == 0 {
		return ""
	}
	encoded, _ := json.Marshal(rows)
	return string(encoded)
}

func (e *scriptExport) extractRules(place exportPlace, source string) (string, string) {
	form := e.target.extract
	var lines []string
	var vars []extractor
	for _, rule := range readExtractors(source) {
		if strings.TrimSpace(rule.Name) == "" {
			continue
		}
		value, ok := form.value(rule)
		switch {
		case !rule.Enabled && !form.inVars(rule):
			e.extractSkipped++
		case !ok:
			e.warn(place, stageExtract, 0, fmt.Sprintf(messageExportExtractLeft, rule.Name, strings.TrimSpace(rule.Expression), e.target.name))
		case form.inVars(rule):
			e.extractVars++
			vars = append(vars, rule)
		default:
			e.extractLines++
			lines = append(lines, form.line(rule, value))
		}
	}
	return strings.Join(lines, "\n"), encodeExtractors(vars)
}

func (e *scriptExport) warn(place exportPlace, stage string, line int, text string) {
	if line > 0 {
		e.warnings = append(e.warnings, fmt.Sprintf(messageExportLine, place.label, stage, line, text))
		return
	}
	e.warnings = append(e.warnings, fmt.Sprintf(messageExportPlace, place.label, stage, text))
}

func (e *scriptExport) report() Report {
	var notes []string
	notes = appendCounted(notes, messageExportUnchanged, e.unchanged, e.target.name)
	notes = appendCounted(notes, messageExportAdapted, e.adapted, listedNames(e.defined), e.target.name)
	notes = appendCounted(notes, messageExportChecks, e.checks, e.target.name)
	notes = appendCounted(notes, messageExportKept, e.kept)
	notes = appendCounted(notes, messageExportSkipped, e.skipped)
	notes = appendCounted(notes, messageExportSkippedTests, e.skippedTests, e.target.name)
	notes = appendCounted(notes, messageExportExtractLines, e.extractLines)
	notes = appendCounted(notes, messageExportExtractVars, e.extractVars)
	notes = appendCounted(notes, messageExportExtractSkipped, e.extractSkipped)
	return Report{Notes: notes, Warnings: e.warnings}
}

type countedText struct {
	one  string
	many string
}

func appendCounted(notes []string, text countedText, count int, values ...any) []string {
	if count == 0 {
		return notes
	}
	format := text.many
	if count == 1 {
		format = text.one
	}
	return append(notes, fmt.Sprintf(format, append([]any{count}, values...)...))
}

func listedNames(defined map[string]bool) string {
	var names []string
	for _, global := range gostmanGlobals {
		if defined[global] {
			names = append(names, global)
		}
	}
	if len(names) < 2 {
		return strings.Join(names, "")
	}
	return strings.Join(names[:len(names)-1], ", ") + " and " + names[len(names)-1]
}
