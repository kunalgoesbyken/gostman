package sandbox

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

const (
	limitExport   = "TIMEOUT_MS"
	messageExport = "TIMED_OUT"
)

type Sandbox struct {
	shared   *machine
	limit    time.Duration
	timedOut string
}

func New() (*Sandbox, error) {
	shared, err := boot()
	if err != nil {
		return nil, err
	}
	return &Sandbox{
		shared:   shared,
		limit:    time.Duration(shared.exports.Get(limitExport).ToInteger()) * time.Millisecond,
		timedOut: shared.exports.Get(messageExport).String(),
	}, nil
}

func (s *Sandbox) Call(function string, result any, arguments ...any) error {
	if s.shared == nil {
		shared, err := boot()
		if err != nil {
			return err
		}
		s.shared = shared
	}
	err := s.run(s.shared, function, result, arguments)
	if err != nil {
		s.shared = nil
	}
	return err
}

func (s *Sandbox) Isolated(function string, result any, arguments ...any) error {
	isolated, err := boot()
	if err != nil {
		return err
	}
	return s.run(isolated, function, result, arguments)
}

func (s *Sandbox) run(target *machine, function string, result any, arguments []any) error {
	encoded, err := target.invoke(function, s.limit, arguments)
	if errors.Is(err, errExpired) {
		return errors.New(s.timedOut)
	}
	if err != nil {
		return err
	}
	if err := json.Unmarshal([]byte(encoded), result); err != nil {
		return fmt.Errorf("%s returned an unexpected value: %w", function, err)
	}
	return nil
}
