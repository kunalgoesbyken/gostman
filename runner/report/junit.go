package report

import (
	"encoding/xml"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/runner"
)

const (
	suitesName      = "Gostman"
	millisPerSecond = 1000.0
)

type junitSuites struct {
	XMLName  xml.Name     `xml:"testsuites"`
	Name     string       `xml:"name,attr"`
	Tests    int          `xml:"tests,attr"`
	Failures int          `xml:"failures,attr"`
	Errors   int          `xml:"errors,attr"`
	Skipped  int          `xml:"skipped,attr"`
	Time     string       `xml:"time,attr"`
	Suites   []junitSuite `xml:"testsuite"`
}

type junitSuite struct {
	Name      string      `xml:"name,attr"`
	Tests     int         `xml:"tests,attr"`
	Failures  int         `xml:"failures,attr"`
	Errors    int         `xml:"errors,attr"`
	Skipped   int         `xml:"skipped,attr"`
	Time      string      `xml:"time,attr"`
	Timestamp string      `xml:"timestamp,attr"`
	Cases     []junitCase `xml:"testcase"`
	Output    string      `xml:"system-out,omitempty"`
}

type junitCase struct {
	Name      string        `xml:"name,attr"`
	ClassName string        `xml:"classname,attr"`
	Time      string        `xml:"time,attr"`
	Failure   *junitProblem `xml:"failure,omitempty"`
	Error     *junitProblem `xml:"error,omitempty"`
	Skipped   *junitProblem `xml:"skipped,omitempty"`
}

type junitProblem struct {
	Message string `xml:"message,attr"`
}

type junitReporter struct {
	output io.Writer
}

func (junitReporter) Request(runner.Result) {}

func seconds(milliseconds int64) string {
	return strconv.FormatFloat(float64(milliseconds)/millisPerSecond, 'f', 3, 64)
}

func requestCase(result runner.Result, suite string) junitCase {
	described := junitCase{
		Name:      strings.TrimSpace(result.Method + " " + result.URL),
		ClassName: suite,
		Time:      seconds(result.DurationMs),
	}
	switch {
	case result.IsSkipped():
		described.Skipped = &junitProblem{Message: result.Skipped}
	case result.Handled != "":
		described.Skipped = &junitProblem{Message: result.Handled}
	case result.Error != "":
		described.Error = &junitProblem{Message: result.Error}
	case result.Failed && result.PassedTests() == len(result.Tests):
		described.Failure = &junitProblem{Message: failureMessage(result)}
	}
	return described
}

func failureMessage(result runner.Result) string {
	if result.Failure == "" {
		return result.Status
	}
	return result.Status + ": " + result.Failure
}

func checkCase(check runner.Check, suite string, handled bool) junitCase {
	described := junitCase{Name: check.Name, ClassName: suite, Time: seconds(0)}
	switch {
	case check.Passed:
	case handled:
		described.Skipped = &junitProblem{Message: check.Message}
	default:
		described.Failure = &junitProblem{Message: check.Message}
	}
	return described
}

func flowSuite(flow *runner.FlowReport, timestamp string, durationMs int64) junitSuite {
	suite := junitSuite{Name: flow.Name, Time: seconds(durationMs), Timestamp: timestamp}
	described := junitCase{Name: flow.Name, ClassName: flow.Name, Time: seconds(durationMs)}
	if flow.Outcome != runner.FlowPassed {
		described.Failure = &junitProblem{Message: flow.Message}
	}
	suite.add(described)
	return suite
}

func suiteOutput(result runner.Result) string {
	lines := make([]string, 0, len(result.Logs)+1)
	if result.ResolvedURL != "" {
		lines = append(lines, strings.TrimSpace(result.Method+" "+result.ResolvedURL))
	}
	for _, line := range result.Logs {
		lines = append(lines, line.Level+": "+line.Text)
	}
	return strings.Join(lines, "\n")
}

func (s *junitSuite) add(described junitCase) {
	s.Cases = append(s.Cases, described)
	s.Tests++
	if described.Failure != nil {
		s.Failures++
	}
	if described.Error != nil {
		s.Errors++
	}
	if described.Skipped != nil {
		s.Skipped++
	}
}

func suiteOf(result runner.Result, timestamp string) junitSuite {
	suite := junitSuite{
		Name:      qualifiedName(result),
		Time:      seconds(result.DurationMs),
		Timestamp: timestamp,
		Output:    suiteOutput(result),
	}
	suite.add(requestCase(result, suite.Name))
	for _, check := range result.Tests {
		suite.add(checkCase(check, suite.Name, result.Handled != ""))
	}
	return suite
}

func (r junitReporter) Finish(report runner.Report) error {
	suites := junitSuites{Name: suitesName, Time: seconds(report.DurationMs)}
	timestamp := report.StartedAt.Format(time.RFC3339)
	all := make([]junitSuite, 0, len(report.Results)+1)
	for _, result := range report.Results {
		all = append(all, suiteOf(result, timestamp))
	}
	if report.Flow != nil {
		all = append(all, flowSuite(report.Flow, timestamp, report.DurationMs))
	}
	for _, suite := range all {
		suites.Tests += suite.Tests
		suites.Failures += suite.Failures
		suites.Errors += suite.Errors
		suites.Skipped += suite.Skipped
		suites.Suites = append(suites.Suites, suite)
	}
	if _, err := io.WriteString(r.output, xml.Header); err != nil {
		return err
	}
	encoder := xml.NewEncoder(r.output)
	encoder.Indent("", "  ")
	if err := encoder.Encode(suites); err != nil {
		return err
	}
	_, err := io.WriteString(r.output, "\n")
	return err
}
