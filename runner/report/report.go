package report

import (
	"fmt"
	"io"
	"slices"

	"github.com/kunalgoesbyken/gostman/runner"
)

const (
	FormatText  = "text"
	FormatJSON  = "json"
	FormatJUnit = "junit"
	FormatHTML  = "html"
)

var Formats = []string{FormatText, FormatJSON, FormatJUnit, FormatHTML}

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
	default:
		return nil, fmt.Errorf("unknown reporter %q", format)
	}
}

func Supports(format string) bool {
	return slices.Contains(Formats, format)
}

func qualifiedName(result runner.Result) string {
	name := result.Name
	if result.Folder != "" {
		name = result.Folder + "/" + result.Name
	}
	if result.Iteration > 0 {
		name = fmt.Sprintf("%s [iteration %d]", name, result.Iteration)
	}
	if result.Attempts > 1 {
		name = fmt.Sprintf("%s [attempt %d of %d]", name, result.Attempt, result.Attempts)
	}
	return name
}
