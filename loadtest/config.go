package loadtest

import (
	"fmt"
	"time"
)

const (
	MaxConcurrency     = 500
	MaxDuration        = 10 * time.Minute
	MaxRequests        = 1_000_000
	DefaultConcurrency = 10
	DefaultDuration    = 10 * time.Second
	DefaultFailureFrom = 500
	MaxErrorSamples    = 10
	ProgressInterval   = 500 * time.Millisecond

	lowestStatus  = 100
	highestStatus = 599
)

type Config struct {
	Concurrency   int `json:"concurrency"`
	DurationMs    int `json:"durationMs"`
	Requests      int `json:"requests"`
	RatePerSecond int `json:"ratePerSecond"`
	RampMs        int `json:"rampMs"`
	FailureStatus int `json:"failureStatus"`
}

func (c Config) Duration() time.Duration {
	return time.Duration(c.DurationMs) * time.Millisecond
}

func (c Config) Ramp() time.Duration {
	return time.Duration(c.RampMs) * time.Millisecond
}

func (c Config) Normalized() Config {
	if c.Concurrency == 0 {
		c.Concurrency = DefaultConcurrency
	}
	if c.DurationMs == 0 && c.Requests == 0 {
		c.DurationMs = int(DefaultDuration / time.Millisecond)
	}
	if c.FailureStatus == 0 {
		c.FailureStatus = DefaultFailureFrom
	}
	return c
}

func (c Config) Validate() error {
	switch {
	case c.Concurrency < 1 || c.Concurrency > MaxConcurrency:
		return fmt.Errorf("concurrency must be between 1 and %d", MaxConcurrency)
	case c.DurationMs < 0 || c.Duration() > MaxDuration:
		return fmt.Errorf("duration must be between 0 and %s", MaxDuration)
	case c.Requests < 0 || c.Requests > MaxRequests:
		return fmt.Errorf("requests must be between 0 and %d", MaxRequests)
	case c.RatePerSecond < 0:
		return fmt.Errorf("the rate cap cannot be negative")
	case c.RampMs < 0 || c.Ramp() > MaxDuration:
		return fmt.Errorf("ramp must be between 0 and %s", MaxDuration)
	case c.FailureStatus < lowestStatus || c.FailureStatus > highestStatus:
		return fmt.Errorf("the failure status must be between %d and %d", lowestStatus, highestStatus)
	}
	return nil
}

func (c Config) workers() int {
	if c.Requests > 0 {
		return min(c.Concurrency, c.Requests)
	}
	return c.Concurrency
}
