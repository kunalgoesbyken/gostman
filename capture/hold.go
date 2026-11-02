package capture

import (
	"cmp"
	"context"
	"encoding/base64"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	DefaultBreakSeconds = 60
	longestBreakSeconds = 3600
	maxHeld             = 25
	maxMethodLength     = 32
)

type Held struct {
	ID           int64                `json:"id"`
	Phase        string               `json:"phase"`
	Time         time.Time            `json:"time"`
	Rule         string               `json:"rule"`
	ExpiresAt    time.Time            `json:"expiresAt"`
	Method       string               `json:"method"`
	URL          string               `json:"url"`
	Status       int                  `json:"status"`
	Headers      []engine.HeaderEntry `json:"headers"`
	Body         string               `json:"body"`
	BodyEncoding string               `json:"bodyEncoding"`
}

type Decision struct {
	Drop         bool                 `json:"drop"`
	Method       string               `json:"method"`
	URL          string               `json:"url"`
	Status       int                  `json:"status"`
	Headers      []engine.HeaderEntry `json:"headers"`
	Body         string               `json:"body"`
	BodyEncoding string               `json:"bodyEncoding"`
}

type verdict int

const (
	verdictEdited verdict = iota
	verdictTimedOut
	verdictDropped
	verdictSkipped
)

func (v verdict) label() string {
	switch v {
	case verdictEdited:
		return "released"
	case verdictTimedOut:
		return "timed out"
	case verdictDropped:
		return "dropped"
	case verdictSkipped:
		return "skipped"
	}
	return ""
}

type pendingHold struct {
	held   Held
	answer chan Decision
}

type holds struct {
	mu      sync.Mutex
	last    int64
	pending map[int64]*pendingHold
}

func (h *holds) enter(held Held) (*pendingHold, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if len(h.pending) >= maxHeld {
		return nil, false
	}
	if h.pending == nil {
		h.pending = map[int64]*pendingHold{}
	}
	h.last++
	held.ID = h.last
	waiting := &pendingHold{held: held, answer: make(chan Decision, 1)}
	h.pending[held.ID] = waiting
	return waiting, true
}

func (h *holds) leave(id int64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.pending, id)
}

func (h *holds) list() []Held {
	h.mu.Lock()
	defer h.mu.Unlock()
	held := make([]Held, 0, len(h.pending))
	for _, waiting := range h.pending {
		held = append(held, waiting.held)
	}
	slices.SortFunc(held, func(a, b Held) int { return cmp.Compare(a.ID, b.ID) })
	return held
}

func (h *holds) settle(id int64, decision Decision) error {
	h.mu.Lock()
	waiting, found := h.pending[id]
	h.mu.Unlock()
	if !found {
		return fmt.Errorf("that exchange is no longer held")
	}
	if err := decision.check(waiting.held.Phase); err != nil {
		return err
	}
	select {
	case waiting.answer <- decision:
		return nil
	default:
		return fmt.Errorf("that exchange was already released")
	}
}

func isMethodToken(method string) bool {
	return len(method) <= maxMethodLength && !strings.ContainsFunc(method, func(r rune) bool { return !unicode.IsLetter(r) || r > unicode.MaxASCII })
}

func (d Decision) check(phase string) error {
	if d.Drop {
		return nil
	}
	if _, err := decodedBody(d.Body, d.BodyEncoding); err != nil {
		return fmt.Errorf("the body is not valid base64")
	}
	if phase == PhaseResponse {
		if d.Status != 0 && (d.Status < 100 || d.Status > 599) {
			return fmt.Errorf("the status must be between 100 and 599")
		}
		return nil
	}
	if d.Method != "" && !isMethodToken(d.Method) {
		return fmt.Errorf("%q is not a valid method", d.Method)
	}
	if d.URL != "" {
		if _, err := parseUpstream(d.URL); err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) breakTimeout() time.Duration {
	seconds := int(s.breakSeconds.Load())
	if seconds <= 0 {
		seconds = DefaultBreakSeconds
	}
	return time.Duration(min(seconds, longestBreakSeconds)) * time.Second
}

func (s *Server) hold(ctx context.Context, held Held) (Decision, verdict) {
	timeout := s.breakTimeout()
	held.Time = time.Now()
	held.ExpiresAt = held.Time.Add(timeout)
	waiting, admitted := s.holds.enter(held)
	if !admitted {
		return Decision{}, verdictSkipped
	}
	defer s.holds.leave(waiting.held.ID)
	if s.hooks.Held != nil {
		s.hooks.Held(waiting.held)
	}
	defer func() {
		if s.hooks.Settled != nil {
			s.hooks.Settled(waiting.held.ID)
		}
	}()
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case decision := <-waiting.answer:
		if decision.Drop {
			return decision, verdictDropped
		}
		return decision, verdictEdited
	case <-timer.C:
		return Decision{}, verdictTimedOut
	case <-ctx.Done():
		return Decision{}, verdictDropped
	}
}

func (s *Server) Held() []Held {
	return s.holds.list()
}

func (s *Server) Release(id int64, decision Decision) error {
	return s.holds.settle(id, decision)
}

func (s *Server) DropHeld(id int64) error {
	return s.holds.settle(id, Decision{Drop: true})
}

func decodedBody(text, encoding string) ([]byte, error) {
	if encoding == engine.EncodingBase64 {
		return base64.StdEncoding.DecodeString(text)
	}
	return []byte(text), nil
}
