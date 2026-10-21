package lint

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"strings"
	"unicode"
)

const (
	FormatText  = "text"
	FormatJSON  = "json"
	FormatJUnit = "junit"
	suiteName   = "gostman lint"
)

func Write(w io.Writer, report Report, format string, failOn Severity) error {
	switch format {
	case FormatText:
		return writeText(w, report)
	case FormatJSON:
		return writeJSON(w, report)
	case FormatJUnit:
		return writeJUnit(w, report, failOn)
	}
	return fmt.Errorf("unknown reporter %q; use text, json or junit", format)
}

func location(finding Finding) string {
	if finding.Operation != "" {
		return finding.Operation + " " + finding.Path
	}
	return finding.Path
}

func unprintable(r rune) bool {
	return unicode.IsControl(r) || unicode.In(r, unicode.Cf, unicode.Zl, unicode.Zp)
}

func visible(text string) string {
	var out strings.Builder
	for _, r := range text {
		switch {
		case !unprintable(r):
			out.WriteRune(r)
		case r > 0xFFFF:
			fmt.Fprintf(&out, `\U%08x`, r)
		default:
			fmt.Fprintf(&out, `\u%04x`, r)
		}
	}
	return out.String()
}

func writeText(w io.Writer, report Report) error {
	for _, finding := range report.Findings {
		if _, err := fmt.Fprintf(w, "%-7s %s  %s\n        %s\n", finding.Severity, visible(finding.Rule), visible(location(finding)), visible(finding.Message)); err != nil {
			return err
		}
	}
	_, err := fmt.Fprintf(w, "%s\n", summaryLine(report.Counts))
	return err
}

func summaryLine(counts Counts) string {
	if counts == (Counts{}) {
		return "No problems found."
	}
	return fmt.Sprintf("%s, %s, %d info", plural(counts.Error, "error"), plural(counts.Warning, "warning"), counts.Info)
}

func plural(count int, noun string) string {
	if count == 1 {
		return fmt.Sprintf("1 %s", noun)
	}
	return fmt.Sprintf("%d %ss", count, noun)
}

func writeJSON(w io.Writer, report Report) error {
	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	return encoder.Encode(report)
}

type junitSuite struct {
	XMLName  xml.Name    `xml:"testsuite"`
	Name     string      `xml:"name,attr"`
	Tests    int         `xml:"tests,attr"`
	Failures int         `xml:"failures,attr"`
	Skipped  int         `xml:"skipped,attr"`
	Cases    []junitCase `xml:"testcase"`
}

type junitCase struct {
	Name    string        `xml:"name,attr"`
	Class   string        `xml:"classname,attr"`
	Failure *junitMessage `xml:"failure,omitempty"`
	Skipped *junitMessage `xml:"skipped,omitempty"`
}

type junitMessage struct {
	Type string `xml:"type,attr"`
	Text string `xml:",chardata"`
}

func writeJUnit(w io.Writer, report Report, failOn Severity) error {
	suite := junitSuite{Name: suiteName}
	for _, finding := range report.Findings {
		suite.add(finding, failOn)
	}
	if len(report.Findings) == 0 {
		suite.Cases = append(suite.Cases, junitCase{Name: "no problems found", Class: suiteName})
		suite.Tests = 1
	}
	if _, err := io.WriteString(w, xml.Header); err != nil {
		return err
	}
	encoder := xml.NewEncoder(w)
	encoder.Indent("", "  ")
	if err := encoder.Encode(suite); err != nil {
		return err
	}
	_, err := io.WriteString(w, "\n")
	return err
}

func (s *junitSuite) add(finding Finding, failOn Severity) {
	message := &junitMessage{Type: string(finding.Severity), Text: visible(strings.TrimSpace(finding.Message))}
	entry := junitCase{Name: visible(location(finding)), Class: visible(finding.Rule)}
	if failOn.rank() > 0 && finding.Severity.rank() >= failOn.rank() {
		entry.Failure = message
		s.Failures++
	} else {
		entry.Skipped = message
		s.Skipped++
	}
	s.Tests++
	s.Cases = append(s.Cases, entry)
}
