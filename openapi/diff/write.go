package diff

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

const truncatedNotice = "The comparison is incomplete: the specs are very large, nest deeply or link to themselves too often, so changes may be missing."

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
	if len(report.Changes) == 0 && !report.Truncated {
		_, err := fmt.Fprintln(w, "No differences in the API description.")
		return err
	}
	for _, change := range report.Changes {
		if _, err := fmt.Fprintf(w, "%-13s %s\n", change.Severity, describe(change)); err != nil {
			return err
		}
	}
	if _, err := fmt.Fprintf(w, "\n%d breaking, %d non-breaking, %d informational\n", report.Breaking, report.NonBreaking, report.Informational); err != nil {
		return err
	}
	if report.Truncated {
		_, err := fmt.Fprintln(w, truncatedNotice)
		return err
	}
	return nil
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
