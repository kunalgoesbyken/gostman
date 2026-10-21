package sandbox

import (
	"errors"
	"fmt"
	"time"
)

const (
	limitExport       = "TIMEOUT_MS"
	messageExport     = "TIMED_OUT"
	sendTimeoutExport = "SEND_TIMEOUT_MS"
	sendsExport       = "MAX_SENDS"
	stepsExport       = "MAX_FLOW_STEPS"
)

type Limits struct {
	SendTimeout time.Duration
	Sends       int
	FlowSteps   int
}

type Sandbox struct {
	shared   *machine
	limit    time.Duration
	timedOut string
	limits   Limits
}

func New() (*Sandbox, error) {
	shared, err := boot(nil)
	if err != nil {
		return nil, err
	}
	return &Sandbox{
		shared:   shared,
		limit:    time.Duration(shared.exports.Get(limitExport).ToInteger()) * time.Millisecond,
		timedOut: shared.exports.Get(messageExport).String(),
		limits: Limits{
			SendTimeout: time.Duration(shared.exports.Get(sendTimeoutExport).ToInteger()) * time.Millisecond,
			Sends:       int(shared.exports.Get(sendsExport).ToInteger()),
			FlowSteps:   int(shared.exports.Get(stepsExport).ToInteger()),
		},
	}, nil
}

func (s *Sandbox) Limits() Limits {
	return s.limits
}

func (s *Sandbox) Call(function string, result any, arguments ...any) error {
	if s.shared == nil {
		shared, err := boot(nil)
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
	return s.IsolatedWith(nil, function, result, arguments...)
}

func (s *Sandbox) IsolatedWith(bridge Bridge, function string, result any, arguments ...any) error {
	isolated, err := boot(bridge)
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
	if errors.Is(err, errMemory) {
		return fmt.Errorf("The script used more than %d MB of memory and was stopped.", memoryAllowance>>20)
	}
	if err != nil {
		return err
	}
	return decodeResult(encoded, result)
}
