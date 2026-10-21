package report

import (
	_ "embed"
	"encoding/json"
	"io"
	"strings"

	"github.com/krockxz/gostman/runner"
)

const dataPlaceholder = "__GOSTMAN_REPORT__"

//go:embed report.html
var htmlTemplate string

type htmlReporter struct {
	output io.Writer
}

func (htmlReporter) Request(runner.Result) {}

func Page(report runner.Report) (string, error) {
	encoded, err := json.Marshal(report)
	if err != nil {
		return "", err
	}
	return strings.Replace(htmlTemplate, dataPlaceholder, string(encoded), 1), nil
}

func (r htmlReporter) Finish(report runner.Report) error {
	page, err := Page(report)
	if err != nil {
		return err
	}
	_, err = io.WriteString(r.output, page)
	return err
}
