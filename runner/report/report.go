package report

import (
	"fmt"
	"io"
	"slices"

	"github.com/kunalgoesbyken/gostman/runner"
)

const (
	FormatText     = "text"
	FormatJSON     = "json"
	FormatJUnit    = "junit"
	FormatHTML     = "html"
	FormatMarkdown = "markdown"
)

var Formats = []string{FormatText, FormatJSON, FormatJUnit, FormatHTML, FormatMarkdown}

type Reporter interface {
	Request(result runner.Result)
	Finish(report runner.Report) error
}

type StepReporter interface {
	Step(event runner.FlowEvent)
}

func New(format string, output io.Writer) (Reporter, error) {
	switch format {
	case FormatText:
		return NewText(output, false), nil
	case FormatJSON:
		return jsonReporter{output: output}, nil
	case FormatJUnit:
		return junitReporter{output: output}, nil
	case FormatHTML:
		return htmlReporter{output: output}, nil
	case FormatMarkdown:
		return markdownReporter{output: output}, nil
	default:
		return nil, fmt.Errorf("unknown reporter %q", format)
	}
}

func Supports(format string) bool {
	return slices.Contains(Formats, format)
}
