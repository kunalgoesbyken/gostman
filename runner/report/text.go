package report

import (
	"bytes"
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
	markFlow = "FLOW"

	logLevelError = "error"

	styleReset  = "\x1b[0m"
	styleRed    = "\x1b[31m"
	styleGreen  = "\x1b[32m"
	styleYellow = "\x1b[33m"
	styleDim    = "\x1b[2m"

	methodWidth  = 7
	kindWidth    = 7
	detailIndent = "      "
	nestedIndent = "            "
	flowIndent   = "    "
)

type Text struct {
	output   io.Writer
	colored  bool
	untested bool
}

func (t *Text) ListUncovered() *Text {
	t.untested = true
	return t
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
	case result.Handled != "":
		return t.paint(styleYellow, markFail)
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
	if result.Handled != "" {
		fmt.Fprintln(t.output, t.paint(styleYellow, indented(Printable(result.Handled), detailIndent)))
	}
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

func Printable(text string) string {
	return strings.Map(func(character rune) rune {
		if character == '\n' || character == '\t' || !unicode.IsControl(character) {
			return character
		}
		return -1
	}, text)
}

func printableResult(result runner.Result) runner.Result {
	result.Method, result.Name, result.Folder = Printable(result.Method), Printable(result.Name), Printable(result.Folder)
	result.Status, result.Skipped, result.Error = Printable(result.Status), Printable(result.Skipped), Printable(result.Error)
	result.Failure, result.ResolvedURL = Printable(result.Failure), Printable(result.ResolvedURL)
	tests := make([]runner.Check, len(result.Tests))
	for i, check := range result.Tests {
		check.Name, check.Message = Printable(check.Name), Printable(check.Message)
		tests[i] = check
	}
	logs := make([]runner.LogLine, len(result.Logs))
	for i, line := range result.Logs {
		line.Level, line.Text = Printable(line.Level), Printable(line.Text)
		logs[i] = line
	}
	result.Tests, result.Logs = tests, logs
	return result
}

type prefixedWriter struct {
	output  io.Writer
	prefix  string
	midLine bool
}

func (w *prefixedWriter) Write(content []byte) (int, error) {
	var buffer bytes.Buffer
	for _, character := range content {
		if !w.midLine {
			buffer.WriteString(w.prefix)
		}
		buffer.WriteByte(character)
		w.midLine = character != '\n'
	}
	if _, err := w.output.Write(buffer.Bytes()); err != nil {
		return 0, err
	}
	return len(content), nil
}

func (t *Text) nest(depth int) func() {
	if depth == 0 {
		return func() {}
	}
	output := t.output
	t.output = &prefixedWriter{output: output, prefix: strings.Repeat(flowIndent, depth)}
	return func() { t.output = output }
}

func (t *Text) Request(received runner.Result) {
	defer t.nest(received.Depth)()
	result := printableResult(received)
	fmt.Fprintf(t.output, "%s  %-*s  %s  %s\n", t.mark(result), methodWidth, result.Method, qualifiedName(result), t.paint(styleDim, outcomeOf(result)))
	if result.ResolvedURL != "" {
		fmt.Fprintln(t.output, t.paint(styleDim, detailIndent+result.ResolvedURL))
	}
	t.printLogs(result)
	t.printFailures(result)
}

func (t *Text) Step(event runner.FlowEvent) {
	defer t.nest(event.Depth)()
	style := styleDim
	if event.Status == runner.FlowFailed {
		style = styleRed
	}
	fmt.Fprintf(t.output, "%s  %-*s  %s  %s\n", t.paint(style, markFlow), kindWidth, Printable(event.Kind), Printable(event.Title), t.paint(styleDim, Printable(event.Summary)))
	for _, check := range event.Checks {
		if !check.Passed {
			fmt.Fprintln(t.output, t.paint(styleDim, indented(Printable(check.Name+": "+check.Message), detailIndent)))
		}
	}
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
		t.paint(styleYellow, counted(summary.Handled, "failed and handled by the flow")),
		counted(summary.Skipped, "skipped"),
		counted(summary.NotRun, "not run"),
	)
	tests := counts(
		fmt.Sprintf("%d passed", summary.Tests-summary.FailedTests),
		t.paint(styleRed, counted(summary.FailedTests, "failed")),
	)
	duration := (time.Duration(report.DurationMs) * time.Millisecond).String()
	_, err := fmt.Fprintf(t.output, "\n%sRequests  %s\nChecks    %s\n%s%sDuration  %s\n", t.flowLine(report), requests, tests, t.contractLine(report), t.coverageLines(report), duration)
	return err
}

func (t *Text) flowLine(report runner.Report) string {
	if report.Flow == nil {
		return ""
	}
	outcome := t.paint(styleGreen, report.Flow.Outcome)
	if report.Flow.Outcome != runner.FlowPassed {
		outcome = t.paint(styleRed, report.Flow.Outcome)
	}
	return fmt.Sprintf("Flow      %s %s: %s\n", Printable(report.Flow.Name), outcome, Printable(report.Flow.Message))
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

func (t *Text) coverageLines(report runner.Report) string {
	coverage := report.Coverage
	if coverage == nil {
		return ""
	}
	var lines strings.Builder
	fmt.Fprintf(&lines, "Coverage  %d of %d operations (%.1f%%), %d of %d documented responses (%.1f%%)\n",
		coverage.Operations.Covered, coverage.Operations.Total, coverage.Operations.Percent,
		coverage.Responses.Covered, coverage.Responses.Total, coverage.Responses.Percent)
	if !t.untested {
		return lines.String()
	}
	for _, item := range coverage.Items {
		lines.WriteString(t.uncoveredLine(item))
	}
	return lines.String()
}

func (t *Text) uncoveredLine(item runner.CoverageOperation) string {
	if !item.Covered {
		return fmt.Sprintf("          %s %s  %s\n", t.paint(styleRed, "not called"), Printable(item.Method), Printable(item.Path))
	}
	var missing []string
	for _, response := range item.Responses {
		if !response.Covered {
			missing = append(missing, Printable(response.Code))
		}
	}
	if len(missing) == 0 {
		return ""
	}
	return fmt.Sprintf("          %s %s  %s: %s\n", t.paint(styleDim, "no response"), Printable(item.Method), Printable(item.Path), strings.Join(missing, ", "))
}
