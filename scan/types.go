package scan

import "github.com/kunalgoesbyken/gostman/workspace"

type Severity string

const (
	High   Severity = "high"
	Medium Severity = "medium"
)

const (
	KindRequest     = "request"
	KindFolder      = "folder"
	KindEnvironment = "environment"
	KindCollection  = "collection"
)

type Location struct {
	Kind      string `json:"kind"`
	Path      string `json:"path"`
	Field     string `json:"field"`
	RequestID string `json:"requestId,omitempty"`
}

type Finding struct {
	Location    Location `json:"location"`
	Rule        string   `json:"rule"`
	Severity    Severity `json:"severity"`
	Preview     string   `json:"preview"`
	Reason      string   `json:"reason"`
	Fingerprint string   `json:"fingerprint"`
}

type Counts struct {
	Requests     int `json:"requests"`
	Folders      int `json:"folders"`
	Environments int `json:"environments"`
}

type Report struct {
	Scanned  Counts    `json:"scanned"`
	Findings []Finding `json:"findings"`

	Truncated int `json:"truncated"`
}

type Options struct {
	SkipExamples bool `json:"skipExamples"`
}

type Query struct {
	Collection *workspace.Collection `json:"collection"`
	Options    Options               `json:"options"`
}

type Reply struct {
	Error string `json:"error,omitempty"`
	Report
}

func Handle(query Query) Reply {
	if query.Collection == nil {
		return Reply{Error: "give a collection to scan"}
	}
	return Reply{Report: Scan(*query.Collection, query.Options)}
}
