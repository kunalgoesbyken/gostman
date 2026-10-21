package scan

import "fmt"

type Threshold int

const (
	ThresholdNone   Threshold = 0
	ThresholdMedium Threshold = 1
	ThresholdHigh   Threshold = 2
)

var thresholdNames = map[string]Threshold{
	"none":   ThresholdNone,
	"medium": ThresholdMedium,
	"high":   ThresholdHigh,
}

var severityRanks = map[Severity]Threshold{
	Medium: ThresholdMedium,
	High:   ThresholdHigh,
}

func ParseThreshold(name string) (Threshold, error) {
	threshold, found := thresholdNames[name]
	if !found {
		return ThresholdNone, fmt.Errorf("unknown --fail-on value %q; choose high, medium or none", name)
	}
	return threshold, nil
}

func (r Report) Reaches(threshold Threshold) bool {
	if threshold == ThresholdNone {
		return false
	}
	for _, finding := range r.Findings {
		if severityRanks[finding.Severity] >= threshold {
			return true
		}
	}
	return false
}

func (r Report) Count(severity Severity) int {
	total := 0
	for _, finding := range r.Findings {
		if finding.Severity == severity {
			total++
		}
	}
	return total
}
