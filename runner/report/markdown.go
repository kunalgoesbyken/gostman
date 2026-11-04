package report

import (
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"github.com/kunalgoesbyken/gostman/runner"
)

const (
	listedFailures   = 30
	longestCodeRunes = 300
)

type markdownReporter struct {
	output io.Writer
}

func (markdownReporter) Request(runner.Result) {}

func (r markdownReporter) Finish(report runner.Report) error {
	var page strings.Builder
	page.WriteString(markdownHeading(report))
	page.WriteString(markdownTable(report))
	page.WriteString(markdownFlow(report.Flow))
	page.WriteString(markdownCoverage(report.Coverage))
	page.WriteString(markdownFailures(report.Results))
	_, err := io.WriteString(r.output, page.String())
	return err
}

func markdownHeading(report runner.Report) string {
	verdict := "passed"
	if report.HasFailed() {
		verdict = "failed"
	}
	context := []string{codeSpan(filepath.Base(report.Collection))}
	if report.Environment != "" {
		context = append(context, "environment "+codeSpan(report.Environment))
	}
	context = append(context, spoken(report.DurationMs))
	return fmt.Sprintf("### Gostman run %s\n\n%s\n\n", verdict, strings.Join(context, " · "))
}

func markdownTable(report runner.Report) string {
	summary := report.Summary
	table := fmt.Sprintf("| | Passed | Failed | Skipped | Not run |\n| --- | ---: | ---: | ---: | ---: |\n| Requests | %d | %d | %d | %d |\n| Checks | %d | %d | | |\n\n",
		summary.Passed, summary.Failed, summary.Skipped, summary.NotRun,
		summary.Tests-summary.FailedTests, summary.FailedTests)
	if summary.Handled > 0 {
		table += counted(summary.Handled, "failed and handled by the flow") + ".\n\n"
	}
	return table
}

func markdownFlow(flow *runner.FlowReport) string {
	if flow == nil {
		return ""
	}
	line := fmt.Sprintf("Flow %s %s", codeSpan(flow.Name), flow.Outcome)
	if flow.Message != "" {
		line += ": " + codeSpan(flow.Message)
	}
	return line + "\n\n"
}

func markdownCoverage(coverage *runner.Coverage) string {
	if coverage == nil {
		return ""
	}
	return "Coverage: " + coverageSummary(*coverage) + "\n\n"
}

func markdownFailures(results []runner.Result) string {
	var failures []runner.Result
	for _, result := range results {
		if result.Failed && result.Handled == "" && !result.IsSkipped() {
			failures = append(failures, result)
		}
	}
	if len(failures) == 0 {
		return ""
	}
	var section strings.Builder
	section.WriteString("#### Failures\n\n")
	for _, result := range failures[:min(len(failures), listedFailures)] {
		section.WriteString(markdownFailure(result))
	}
	if hidden := len(failures) - listedFailures; hidden > 0 {
		fmt.Fprintf(&section, "\n%s more in the job log.\n", plural(hidden, "failed request"))
	}
	return section.String()
}

func markdownFailure(result runner.Result) string {
	var item strings.Builder
	item.WriteString("- " + codeSpan(result.Method+" "+qualifiedName(result)))
	if result.Error == "" && result.Status != "" {
		item.WriteString(" returned " + codeSpan(result.Status))
	}
	item.WriteString("\n")
	for _, problem := range []string{result.Error, result.Failure} {
		if problem != "" {
			fmt.Fprintf(&item, "  - %s\n", codeSpan(problem))
		}
	}
	for _, check := range result.Tests {
		if check.Passed {
			continue
		}
		fmt.Fprintf(&item, "  - %s", codeSpan(check.Name))
		if check.Message != "" {
			fmt.Fprintf(&item, ": %s", codeSpan(check.Message))
		}
		item.WriteString("\n")
	}
	return item.String()
}

func codeSpan(text string) string {
	flat := strings.Join(strings.Fields(Printable(text)), " ")
	if flat == "" {
		return ""
	}
	if runes := []rune(flat); len(runes) > longestCodeRunes {
		flat = string(runes[:longestCodeRunes]) + "…"
	}
	fence := strings.Repeat("`", longestBacktickRun(flat)+1)
	if strings.HasPrefix(flat, "`") || strings.HasSuffix(flat, "`") {
		flat = " " + flat + " "
	}
	return fence + flat + fence
}

func longestBacktickRun(text string) int {
	longest, current := 0, 0
	for _, character := range text {
		if character != '`' {
			current = 0
			continue
		}
		current++
		longest = max(longest, current)
	}
	return longest
}
