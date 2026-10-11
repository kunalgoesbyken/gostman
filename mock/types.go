package mock

import "time"

const DefaultPort = 4010

const (
	StateServed    = "served"
	StateNoExample = "no-example"
	StateConflict  = "conflict"
	StateSkipped   = "skipped"
)

type Source struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Method    string `json:"method"`
	URL       string `json:"url"`
	Examples  string `json:"examples"`
	ExampleID string `json:"exampleId"`
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
	Reason      string `json:"reason"`
	ExampleID   string `json:"exampleId"`
	ExampleName string `json:"exampleName"`
}

type Settings struct {
	Port    int  `json:"port"`
	DelayMs int  `json:"delayMs"`
	CORS    bool `json:"cors"`
}

type Entry struct {
	Time       time.Time `json:"time"`
	Method     string    `json:"method"`
	Path       string    `json:"path"`
	Route      string    `json:"route"`
	Status     int       `json:"status"`
	DurationMs int64     `json:"durationMs"`
}
