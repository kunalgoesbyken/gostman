package sandbox

import (
	"errors"
	"fmt"
	"time"
)

const (
	limitExport       = "TIMEOUT_MS"
	allowanceExport   = "scriptAllowance"
	sendTimeoutExport = "SEND_TIMEOUT_MS"
	sendsExport       = "MAX_SENDS"
	stepsExport       = "MAX_FLOW_STEPS"
)

type Limits struct {
	SendTimeout time.Duration
	Sends       int
	FlowSteps   int
}

type Allowance struct {
	Limit   int64  `json:"limit"`
	Message string `json:"message"`
}

func (a Allowance) duration() time.Duration {
	return time.Duration(a.Limit) * time.Millisecond
}

type Sandbox struct {
	shared   *machine
	standard Allowance
	limits   Limits
}

func New() (*Sandbox, error) {
	shared, err := boot(nil)
	if err != nil {
		return nil, err
	}
	sandbox := &Sandbox{
		shared:   shared,
		standard: Allowance{Limit: shared.exports.Get(limitExport).ToInteger()},
		limits: Limits{
			SendTimeout: time.Duration(shared.exports.Get(sendTimeoutExport).ToInteger()) * time.Millisecond,
			Sends:       int(shared.exports.Get(sendsExport).ToInteger()),
			FlowSteps:   int(shared.exports.Get(stepsExport).ToInteger()),
		},
	}
	sandbox.standard, err = sandbox.Allowance(sandbox.standard.Limit)
	return sandbox, err
}

func (s *Sandbox) Allowance(milliseconds int64) (Allowance, error) {
	var allowance Allowance
	err := s.Call(allowanceExport, &allowance, milliseconds)
	return allowance, err
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
	err := s.run(s.shared, s.standard, function, result, arguments)
	if err != nil {
		s.shared = nil
	}
	return err
}

func (s *Sandbox) Isolated(allowance Allowance, bridge Bridge, function string, result any, arguments ...any) error {
	isolated, err := boot(bridge)
	if err != nil {
		return err
	}
	return s.run(isolated, allowance, function, result, arguments)
}

func (s *Sandbox) run(target *machine, allowance Allowance, function string, result any, arguments []any) error {
	encoded, err := target.invoke(function, allowance.duration(), arguments)
	if errors.Is(err, errExpired) {
		return errors.New(allowance.Message)
	}
	if errors.Is(err, errMemory) {
		return fmt.Errorf("The script used more than %d MB of memory and was stopped.", memoryAllowance>>20)
	}
	if err != nil {
		return err
	}
	return decodeResult(encoded, result)
}
