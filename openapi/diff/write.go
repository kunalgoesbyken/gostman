package diff

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

const (
	FormatText = "text"
	FormatJSON = "json"
)

func Write(w io.Writer, report Report, format string) error {
	if format == FormatJSON {
		encoder := json.NewEncoder(w)
		encoder.SetIndent("", "  ")
		return encoder.Encode(report)
	}
	if len(report.Changes) == 0 {
		_, err := fmt.Fprintln(w, "No differences in the API description.")
		return err
	}
	for _, change := range report.Changes {
		if _, err := fmt.Fprintf(w, "%-13s %s\n", change.Severity, describe(change)); err != nil {
			return err
		}
	}
	_, err := fmt.Fprintf(w, "\n%d breaking, %d non-breaking, %d informational\n", report.Breaking, report.NonBreaking, report.Informational)
	return err
}

func describe(change Change) string {
	var place []string
	if change.Method != "" {
		place = append(place, change.Method)
	}
	if change.Path != "" {
		place = append(place, change.Path)
	}
	if change.Where != "" {
		place = append(place, change.Where)
	}
	if len(place) == 0 {
		return change.Message
	}
	return strings.Join(place, " ") + ": " + change.Message
}
