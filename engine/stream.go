package engine

import (
	"context"
	"errors"
	"io"
	"net/http"
	"time"
)

const (
	ProtocolSSE = "sse"

	StreamOpen     = "open"
	StreamEvent    = "event"
	StreamWait     = "wait"
	StreamEnd      = "end"
	StreamResponse = "response"

	EndClosed      = "closed"
	EndCancelled   = "cancelled"
	EndMaxEvents   = "maxEvents"
	EndMaxBytes    = "maxBytes"
	EndMaxDuration = "maxDuration"
	EndFailed      = "failed"

	mediaEventStream  = "text/event-stream"
	headerLastEventID = "Last-Event-ID"

	defaultStreamEvents   = 10_000
	maxStreamEvents       = 100_000
	defaultStreamDuration = 5 * time.Minute
	defaultRetry          = 3 * time.Second
	minRetry              = 100 * time.Millisecond
	readBufferBytes       = 32 << 10
)

type StreamMessage struct {
	Kind     string    `json:"kind"`
	Event    *Event    `json:"event,omitempty"`
	Response *Response `json:"response,omitempty"`
	RetryMs  int64     `json:"retryMs,omitempty"`
	Attempt  int       `json:"attempt,omitempty"`
	Reason   string    `json:"reason,omitempty"`
	Detail   string    `json:"detail,omitempty"`
}

type stream struct {
	request   Request
	policy    Policy
	out       *batcher
	parser    eventParser
	maxEvents int
	maxBytes  int64
	events    int
	bytes     int64
	attempt   int
}

func Stream(ctx context.Context, r Request, policy Policy, emit func([]StreamMessage)) Response {
	started := time.Now()
	s := &stream{
		request:   r,
		policy:    policy,
		out:       &batcher{emit: emit},
		maxEvents: eventLimit(r.Options),
		maxBytes:  policy.ResponseLimit(),
	}
	defer s.out.flush()

	ctx, cancel := context.WithTimeout(ctx, policy.streamDuration(r.Options))
	defer cancel()

	response := s.run(ctx)
	response.DurationMs = time.Since(started).Milliseconds()
	return response
}

func (p Policy) streamDuration(options Options) time.Duration {
	duration := defaultStreamDuration
	if options.StreamMaxSeconds > 0 {
		duration = time.Duration(options.StreamMaxSeconds) * time.Second
	}
	if p.MaxStreamDuration > 0 && duration > p.MaxStreamDuration {
		return p.MaxStreamDuration
	}
	return duration
}

func eventLimit(options Options) int {
	if options.StreamMaxEvents <= 0 {
		return defaultStreamEvents
	}
	return min(options.StreamMaxEvents, maxStreamEvents)
}

func (s *stream) run(ctx context.Context) Response {
	incoming, cookies, failure := s.dial(ctx)
	if failure != nil {
		return *failure
	}
	if !carriesEvents(incoming) {
		defer incoming.Body.Close()
		return collect(ctx, incoming, cookies, s.maxBytes)
	}

	response := streamResponse(incoming, cookies)
	reason, detail := s.read(ctx, incoming, response)
	for s.shouldReconnect(ctx, reason) {
		if !s.pause(ctx) {
			reason, detail = endReason(ctx, ctx.Err())
			break
		}
		next, nextCookies, failure := s.dial(ctx)
		if failure != nil {
			reason, detail = endReason(ctx, errors.New(failure.Body))
			break
		}
		if !carriesEvents(next) {
			next.Body.Close()
			reason, detail = EndFailed, next.Status
			break
		}
		reason, detail = s.read(ctx, next, streamResponse(next, nextCookies))
	}
	s.out.add(StreamMessage{Kind: StreamEnd, Reason: reason, Detail: detail})
	response.Size = s.bytes
	return response
}

func (s *stream) dial(ctx context.Context) (*http.Response, *cookieLog, *Response) {
	outgoing, client, cookies, err := newExchange(ctx, s.request, s.policy)
	if err != nil {
		failure := Failure(ErrorConfig, err.Error())
		return nil, nil, &failure
	}
	if s.parser.lastID != "" {
		outgoing.Header.Set(headerLastEventID, s.parser.lastID)
	}
	incoming, err := client.Do(outgoing)
	if err != nil {
		failure := classify(ctx, err)
		return nil, nil, &failure
	}
	return incoming, cookies, nil
}

func carriesEvents(incoming *http.Response) bool {
	return incoming.StatusCode == http.StatusOK && MediaType(incoming.Header.Get(headerContentType), nil) == mediaEventStream
}

func streamResponse(incoming *http.Response, cookies *cookieLog) Response {
	cookies.record(incoming)
	response := describe(incoming, cookies)
	response.ContentType = mediaEventStream
	response.BodyEncoding = EncodingUTF8
	response.Protocol = ProtocolSSE
	return response
}

func (s *stream) read(ctx context.Context, incoming *http.Response, opened Response) (string, string) {
	defer incoming.Body.Close()
	s.out.add(StreamMessage{Kind: StreamOpen, Response: &opened})
	buffer := make([]byte, readBufferBytes)
	for {
		count, err := incoming.Body.Read(buffer)
		if reason, done := s.accept(buffer[:count]); done {
			return reason, ""
		}
		if err != nil {
			return endReason(ctx, err)
		}
	}
}

func (s *stream) accept(chunk []byte) (string, bool) {
	room := s.maxBytes - s.bytes
	capped := int64(len(chunk)) > room
	if capped {
		chunk = chunk[:room]
	}
	s.bytes += int64(len(chunk))
	for _, event := range s.parser.feed(chunk) {
		s.events++
		event.Index = s.events
		s.out.add(StreamMessage{Kind: StreamEvent, Event: &event})
		if s.events >= s.maxEvents {
			return EndMaxEvents, true
		}
	}
	if capped {
		return EndMaxBytes, true
	}
	return "", false
}

func endReason(ctx context.Context, err error) (string, string) {
	switch {
	case errors.Is(err, io.EOF):
		return EndClosed, ""
	case errors.Is(ctx.Err(), context.DeadlineExceeded):
		return EndMaxDuration, ""
	case errors.Is(ctx.Err(), context.Canceled):
		return EndCancelled, ""
	default:
		return EndFailed, err.Error()
	}
}

func (s *stream) shouldReconnect(ctx context.Context, reason string) bool {
	return s.request.Options.StreamReconnect && ctx.Err() == nil && (reason == EndClosed || reason == EndFailed)
}

func (s *stream) pause(ctx context.Context) bool {
	delay := defaultRetry
	if s.parser.retryMs > 0 {
		delay = time.Duration(s.parser.retryMs) * time.Millisecond
	}
	delay = max(delay, minRetry)
	s.attempt++
	s.out.add(StreamMessage{Kind: StreamWait, RetryMs: delay.Milliseconds(), Attempt: s.attempt})

	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-timer.C:
		return true
	case <-ctx.Done():
		return false
	}
}
