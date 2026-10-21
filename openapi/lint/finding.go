package lint

type Severity string

const (
	SeverityError   Severity = "error"
	SeverityWarning Severity = "warning"
	SeverityInfo    Severity = "info"
	SeverityOff     Severity = "off"
	SeverityNone    Severity = "none"
)

var severityRank = map[Severity]int{SeverityError: 3, SeverityWarning: 2, SeverityInfo: 1}

func (s Severity) rank() int { return severityRank[s] }

func (s Severity) configurable() bool {
	_, known := severityRank[s]
	return known || s == SeverityOff
}

type Finding struct {
	Rule      string   `json:"rule"`
	Severity  Severity `json:"severity"`
	Message   string   `json:"message"`
	Path      string   `json:"path"`
	Operation string   `json:"operation,omitempty"`
}

type Counts struct {
	Error   int `json:"error"`
	Warning int `json:"warning"`
	Info    int `json:"info"`
}

type Report struct {
	Findings []Finding `json:"findings"`
	Counts   Counts    `json:"counts"`
}

func (c *Counts) add(severity Severity) {
	switch severity {
	case SeverityError:
		c.Error++
	case SeverityWarning:
		c.Warning++
	case SeverityInfo:
		c.Info++
	}
}

func (r Report) Reaches(threshold Severity) bool {
	if threshold.rank() == 0 {
		return false
	}
	for _, finding := range r.Findings {
		if finding.Severity.rank() >= threshold.rank() {
			return true
		}
	}
	return false
}
