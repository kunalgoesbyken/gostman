package mock

import "time"

const DefaultPort = 4010

const (
	StateServed    = "served"
	StateNoExample = "no-example"
	StateConflict  = "conflict"
	StateSkipped   = "skipped"
	StateDisabled  = "disabled"
)

const (
	FaultStatus = "status"
	FaultReset  = "reset"
	FaultEmpty  = "empty"
)

const (
	FieldQuery  = "query"
	FieldHeader = "header"
	FieldBody   = "body"
)

const (
	OpEquals   = "equals"
	OpContains = "contains"
	OpExists   = "exists"
)

type Source struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Method    string            `json:"method"`
	URL       string            `json:"url"`
	Examples  string            `json:"examples"`
	ExampleID string            `json:"exampleId"`
	Path      string            `json:"path"`
	Types     map[string]string `json:"types"`
	Disabled  bool              `json:"-"`
	Behavior  Behavior          `json:"-"`
}

type Header struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type Example struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Status       int      `json:"status"`
	Headers      []Header `json:"headers"`
	Body         string   `json:"body"`
	BodyEncoding string   `json:"bodyEncoding"`
	ContentType  string   `json:"contentType"`
	IsDefault    bool     `json:"isDefault"`
}

type Route struct {
	RequestID   string `json:"requestId"`
	Name        string `json:"name"`
	Method      string `json:"method"`
	Path        string `json:"path"`
	State       string `json:"state"`
	Reason      string `json:"reason,omitempty"`
	ExampleID   string `json:"exampleId,omitempty"`
	ExampleName string `json:"exampleName,omitempty"`
}

type Fault struct {
	Percent int    `json:"percent"`
	Kind    string `json:"kind"`
	Status  int    `json:"status"`
}

type Behavior struct {
	DelayMs    int   `json:"delayMs"`
	DelayMaxMs int   `json:"delayMaxMs"`
	SlowBodyMs int   `json:"slowBodyMs"`
	Fault      Fault `json:"fault"`
}

type Settings struct {
	Port        int      `json:"port"`
	CORS        bool     `json:"cors"`
	CORSOrigins []string `json:"corsOrigins"`
	Behavior    Behavior `json:"behavior"`
}

type Condition struct {
	Field string `json:"field"`
	Name  string `json:"name"`
	Op    string `json:"op"`
	Value string `json:"value"`
}

type Rule struct {
	ID         string      `json:"id"`
	Name       string      `json:"name"`
	Disabled   bool        `json:"disabled"`
	Method     string      `json:"method"`
	Path       string      `json:"path"`
	Conditions []Condition `json:"conditions"`
	Nth        int         `json:"nth"`
	ExampleID  string      `json:"exampleId"`
	Status     int         `json:"status"`
	Headers    []Header    `json:"headers"`
	Body       string      `json:"body"`
	Behavior   Behavior    `json:"behavior"`
}

type Entry struct {
	ID         int64     `json:"id"`
	Time       time.Time `json:"time"`
	Method     string    `json:"method"`
	Path       string    `json:"path"`
	Headers    []Header  `json:"headers"`
	Body       string    `json:"body"`
	BodyBytes  int       `json:"bodyBytes"`
	Route      string    `json:"route"`
	Rule       string    `json:"rule"`
	Fault      string    `json:"fault"`
	Status     int       `json:"status"`
	DurationMs int64     `json:"durationMs"`
}
