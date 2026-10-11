package capture

import (
	"time"

	"github.com/krockxz/gostman/engine"
)

const DefaultPort = 4020

type Settings struct {
	Upstream string `json:"upstream"`
	Port     int    `json:"port"`
}

type Message struct {
	Headers      []engine.HeaderEntry `json:"headers"`
	Body         string               `json:"body"`
	BodyEncoding string               `json:"bodyEncoding"`
	ContentType  string               `json:"contentType"`
	Size         int64                `json:"size"`
	Truncated    bool                 `json:"truncated"`
}

type Exchange struct {
	ID          int64     `json:"id"`
	Time        time.Time `json:"time"`
	Method      string    `json:"method"`
	Path        string    `json:"path"`
	URL         string    `json:"url"`
	Request     Message   `json:"request"`
	Status      int       `json:"status"`
	Response    Message   `json:"response"`
	DurationMs  int64     `json:"durationMs"`
	Upgraded    bool      `json:"upgraded"`
	Interrupted bool      `json:"interrupted"`
	Error       string    `json:"error"`
}

func (e Exchange) Summary() Exchange {
	e.Request.Body = ""
	e.Response.Body = ""
	return e
}
