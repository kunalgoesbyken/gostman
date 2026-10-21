package runner

import (
	"context"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	defaultStreamSeconds = 10
	defaultStreamEvents  = 100
	defaultEventType     = "message"
)

func (o Options) streamSeconds() int {
	if o.StreamTimeout <= 0 {
		return defaultStreamSeconds
	}
	return int((o.StreamTimeout + time.Second - 1) / time.Second)
}

func withStreamBudget(options engine.Options, seconds int) engine.Options {
	if !options.Stream {
		return options
	}
	if options.StreamMaxSeconds <= 0 {
		options.StreamMaxSeconds = seconds
	}
	if options.StreamMaxEvents <= 0 {
		options.StreamMaxEvents = defaultStreamEvents
	}
	return options
}

func eventText(event engine.Event) string {
	var lines []string
	if event.ID != "" {
		lines = append(lines, "id: "+event.ID)
	}
	if event.Type != defaultEventType {
		lines = append(lines, "event: "+event.Type)
	}
	for _, line := range strings.Split(event.Data, "\n") {
		lines = append(lines, "data: "+line)
	}
	return strings.Join(lines, "\n") + "\n\n"
}

func (s *session) collectStream(ctx context.Context, prepared engine.Request) engine.Response {
	var body strings.Builder
	response := engine.Stream(ctx, prepared, s.policy, func(messages []engine.StreamMessage) {
		for _, message := range messages {
			if message.Kind == engine.StreamEvent {
				body.WriteString(eventText(*message.Event))
			}
		}
	})
	if response.Protocol == engine.ProtocolSSE {
		response.Body = body.String()
	}
	return response
}
