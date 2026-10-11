package report

import (
	"fmt"
	"io"
	"slices"

	"github.com/krockxz/gostman/runner"
)

const (
	FormatText  = "text"
	FormatJSON  = "json"
	FormatJUnit = "junit"
)

var Formats = []string{FormatText, FormatJSON, FormatJUnit}

type Reporter interface {
	Request(result runner.Result)
	Finish(report runner.Report) error
}

func New(format string, output io.Writer) (Reporter, error) {
	switch format {
	case FormatText:
		return NewText(output, false), nil
	case FormatJSON:
		return jsonReporter{output: output}, nil
	case FormatJUnit:
		return junitReporter{output: output}, nil
	default:
		return nil, fmt.Errorf("unknown reporter %q", format)
	}
}

func Supports(format string) bool {
	return slices.Contains(Formats, format)
}

func qualifiedName(result runner.Result) string {
	if result.Folder == "" {
		return result.Name
	}
	return result.Folder + "/" + result.Name
}
