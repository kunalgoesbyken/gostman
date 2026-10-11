package report

import (
	"encoding/json"
	"io"

	"github.com/krockxz/gostman/runner"
)

type jsonReporter struct {
	output io.Writer
}

func (jsonReporter) Request(runner.Result) {}

func (r jsonReporter) Finish(report runner.Report) error {
	encoder := json.NewEncoder(r.output)
	encoder.SetIndent("", "  ")
	encoder.SetEscapeHTML(false)
	return encoder.Encode(report)
}
