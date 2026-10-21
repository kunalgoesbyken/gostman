package engine

import (
	"bytes"
	"strconv"
	"strings"
	"time"
)

const (
	maxEventData    = 1 << 20
	lineBreaks      = "\r\n"
	fieldEvent      = "event"
	fieldData       = "data"
	fieldID         = "id"
	fieldRetry      = "retry"
	defaultEventTag = "message"
)

var (
	byteOrderMark = []byte("\xEF\xBB\xBF")
	space         = []byte(" ")
	colon         = []byte(":")
	newline       = []byte("\n")
)

type Event struct {
	Index     int    `json:"index"`
	Type      string `json:"type"`
	ID        string `json:"id"`
	Data      string `json:"data"`
	Truncated bool   `json:"truncated,omitempty"`
	Time      int64  `json:"time"`
}

type eventParser struct {
	line      []byte
	skipLF    bool
	started   bool
	data      []byte
	hasData   bool
	truncated bool
	name      string
	lastID    string
	retryMs   int
}

func (p *eventParser) feed(chunk []byte) []Event {
	var events []Event
	for len(chunk) > 0 {
		if p.skipLF {
			p.skipLF = false
			if chunk[0] == '\n' {
				chunk = chunk[1:]
				continue
			}
		}
		end := bytes.IndexAny(chunk, lineBreaks)
		if end < 0 {
			p.line = append(p.line, chunk...)
			break
		}
		p.line = append(p.line, chunk[:end]...)
		p.skipLF = chunk[end] == '\r'
		chunk = chunk[end+1:]
		if event, ok := p.consumeLine(); ok {
			events = append(events, event)
		}
	}
	return events
}

func (p *eventParser) consumeLine() (Event, bool) {
	line := p.line
	p.line = p.line[:0]
	if !p.started {
		p.started = true
		line = bytes.TrimPrefix(line, byteOrderMark)
	}
	if len(line) == 0 {
		return p.dispatch()
	}
	if line[0] == ':' {
		return Event{}, false
	}
	field, value, _ := bytes.Cut(line, colon)
	p.apply(string(field), bytes.TrimPrefix(value, space))
	return Event{}, false
}

func (p *eventParser) apply(field string, value []byte) {
	switch field {
	case fieldEvent:
		p.name = string(value)
	case fieldData:
		p.appendData(value)
	case fieldID:
		if !bytes.ContainsRune(value, 0) {
			p.lastID = string(value)
		}
	case fieldRetry:
		if milliseconds, err := strconv.ParseUint(string(value), 10, 31); err == nil {
			p.retryMs = int(milliseconds)
		}
	}
}

func (p *eventParser) appendData(value []byte) {
	p.hasData = true
	if len(p.data)+len(value)+1 > maxEventData {
		p.truncated = true
		return
	}
	p.data = append(append(p.data, value...), '\n')
}

func (p *eventParser) dispatch() (Event, bool) {
	defer p.reset()
	if !p.hasData {
		return Event{}, false
	}
	name := p.name
	if name == "" {
		name = defaultEventTag
	}
	data := strings.ToValidUTF8(string(bytes.TrimSuffix(p.data, newline)), "�")
	return Event{Type: name, ID: p.lastID, Data: data, Truncated: p.truncated, Time: time.Now().UnixMilli()}, true
}

func (p *eventParser) reset() {
	p.data = p.data[:0]
	p.hasData = false
	p.truncated = false
	p.name = ""
}
