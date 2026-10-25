package report

import (
	"fmt"
	"io"
	"strings"
	"time"
	"unicode"

	"github.com/kunalgoesbyken/gostman/runner"
)

const (
	markPass = "PASS"
	markFail = "FAIL"
	markSkip = "SKIP"

	logLevelError = "error"

	styleReset  = "\x1b[0m"
	styleRed    = "\x1b[31m"
	styleGreen  = "\x1b[32m"
	styleYellow = "\x1b[33m"
	styleDim    = "\x1b[2m"

	methodWidth  = 7
	detailIndent = "      "
	nestedIndent = "            "
)

type Text struct {
	output  io.Writer
	colored bool
}

func NewText(output io.Writer, colored bool) *Text {
	return &Text{output: output, colored: colored}
}

func (t *Text) paint(style, text string) string {
	if !t.colored || text == "" {
		return text
	}
	return style + text + styleReset
}

func (t *Text) mark(result runner.Result) string {
	switch {
	case result.IsSkipped():
		return t.paint(styleYellow, markSkip)
	case result.Failed:
		return t.paint(styleRed, markFail)
	default:
		return t.paint(styleGreen, markPass)
	}
}

func outcomeOf(result runner.Result) string {
	if result.IsSkipped() {
		return result.Skipped
	}
	parts := []string{result.Status, fmt.Sprintf("%d ms", result.DurationMs)}
	if result.StreamEnd != "" {
		parts = append(parts, "stream "+result.StreamEnd)
	}
	if total := len(result.Tests); total > 0 {
		parts = append(parts, fmt.Sprintf("%d/%d checks", result.PassedTests(), total))
	}
	return strings.Join(parts, "  ")
}

func indented(text, indent string) string {
	lines := strings.Split(text, "\n")
	for index, line := range lines {
		if line != "" {
			lines[index] = indent + line
		}
	}
	return strings.Join(lines, "\n")
}

func (t *Text) printFailures(result runner.Result) {
	for _, problem := range []string{result.Error, result.Failure} {
		if problem != "" {
			fmt.Fprintln(t.output, t.paint(styleRed, indented(problem, detailIndent)))
		}
	}
	for _, check := range result.Tests {
		if check.Passed {
			continue
		}
		fmt.Fprintf(t.output, "%s%s  %s\n", detailIndent, t.paint(styleRed, markFail), check.Name)
		if check.Message != "" {
			fmt.Fprintln(t.output, t.paint(styleDim, indented(check.Message, nestedIndent)))
		}
	}
}

func restatesError(result runner.Result, line runner.LogLine) bool {
	return line.Level == logLevelError && line.Text != "" && strings.Contains(result.Error, line.Text)
}

func (t *Text) printLogs(result runner.Result) {
	for _, line := range result.Logs {
		if restatesError(result, line) {
			continue
		}
		fmt.Fprintln(t.output, t.paint(styleDim, indented(line.Level+": "+line.Text, detailIndent)))
	}
}

func printable(text string) string {
	return strings.Map(func(character rune) rune {
		if character == '\n' || character == '\t' || !unicode.IsControl(character) {
			return character
		}
		return -1
	}, text)
}

func printableResult(result runner.Result) runner.Result {
	result.Method, result.Name, result.Folder = printable(result.Method), printable(result.Name), printable(result.Folder)
	result.Status, result.Skipped, result.Error = printable(result.Status), printable(result.Skipped), printable(result.Error)
	result.Failure, result.ResolvedURL = printable(result.Failure), printable(result.ResolvedURL)
	tests := make([]runner.Check, len(result.Tests))
	for i, check := range result.Tests {
		check.Name, check.Message = printable(check.Name), printable(check.Message)
		tests[i] = check
	}
	logs := make([]runner.LogLine, len(result.Logs))
	for i, line := range result.Logs {
		line.Level, line.Text = printable(line.Level), printable(line.Text)
		logs[i] = line
	}
	result.Tests, result.Logs = tests, logs
	return result
}

func (t *Text) Request(received runner.Result) {
	result := printableResult(received)
	fmt.Fprintf(t.output, "%s  %-*s  %s  %s\n", t.mark(result), methodWidth, result.Method, qualifiedName(result), t.paint(styleDim, outcomeOf(result)))
	if result.ResolvedURL != "" {
		fmt.Fprintln(t.output, t.paint(styleDim, detailIndent+result.ResolvedURL))
	}
	t.printLogs(result)
	t.printFailures(result)
}

func counts(entries ...string) string {
	var kept []string
	for _, entry := range entries {
		if entry != "" {
			kept = append(kept, entry)
		}
	}
	return strings.Join(kept, ", ")
}

func counted(count int, label string) string {
	if count == 0 {
		return ""
	}
	return fmt.Sprintf("%d %s", count, label)
}

func (t *Text) Finish(report runner.Report) error {
	summary := report.Summary
	requests := counts(
		fmt.Sprintf("%d passed", summary.Passed),
		t.paint(styleRed, counted(summary.Failed, "failed")),
		counted(summary.Skipped, "skipped"),
		counted(summary.NotRun, "not run"),
	)
	tests := counts(
		fmt.Sprintf("%d passed", summary.Tests-summary.FailedTests),
		t.paint(styleRed, counted(summary.FailedTests, "failed")),
	)
	duration := (time.Duration(report.DurationMs) * time.Millisecond).String()
	_, err := fmt.Fprintf(t.output, "\nRequests  %s\nChecks    %s\n%sDuration  %s\n", requests, tests, t.contractLine(report), duration)
	return err
}

func (t *Text) contractLine(report runner.Report) string {
	total, failed := 0, 0
	for _, result := range report.Results {
		for _, check := range result.Tests {
			if check.Kind != runner.ContractKind {
				continue
			}
			total++
			if !check.Passed {
				failed++
			}
		}
	}
	if total == 0 {
		return ""
	}
	return fmt.Sprintf("Contract  %s\n", counts(fmt.Sprintf("%d passed", total-failed), t.paint(styleRed, counted(failed, "failed"))))
}
