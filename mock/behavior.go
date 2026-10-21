package mock

import (
	"fmt"
	"math/rand/v2"
	"net/http"
	"sync"
	"time"

	"github.com/kunalgoesbyken/gostman/loopback"
)

const (
	highestDelayMs = 60_000
	highestPercent = 100
	defaultFault   = http.StatusInternalServerError
	slowChunks     = 10
)

type chance struct {
	mu  sync.Mutex
	rng *rand.Rand
}

func newChance(first, second uint64) *chance {
	return &chance{rng: rand.New(rand.NewPCG(first, second))}
}

func (c *chance) below(limit int) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.rng.IntN(limit)
}

func (c *chance) roll(percent int) bool {
	return percent > 0 && c.below(highestPercent) < percent
}

func (c *chance) between(low, high int) int {
	if high <= low {
		return low
	}
	return low + c.below(high-low+1)
}

func (b Behavior) isZero() bool {
	return b == Behavior{}
}

func (b Behavior) validate() error {
	for _, value := range []int{b.DelayMs, b.DelayMaxMs, b.SlowBodyMs} {
		if value < 0 || value > highestDelayMs {
			return fmt.Errorf("delays must be between 0 and %d ms", highestDelayMs)
		}
	}
	if b.DelayMaxMs != 0 && b.DelayMaxMs < b.DelayMs {
		return fmt.Errorf("the longest delay must not be shorter than the shortest")
	}
	return b.Fault.validate()
}

func (f Fault) validate() error {
	if f.Percent < 0 || f.Percent > highestPercent {
		return fmt.Errorf("the fault rate must be between 0 and %d percent", highestPercent)
	}
	switch f.Kind {
	case "", FaultStatus, FaultReset, FaultEmpty:
	default:
		return fmt.Errorf("unknown fault kind %q", f.Kind)
	}
	if f.Status != 0 && (f.Status < http.StatusBadRequest || f.Status > highestStatus) {
		return fmt.Errorf("the fault status must be between %d and %d", http.StatusBadRequest, highestStatus)
	}
	return nil
}

func (f Fault) kind() string {
	if f.Kind == "" {
		return FaultStatus
	}
	return f.Kind
}

func (f Fault) status() int {
	if f.Status == 0 {
		return defaultFault
	}
	return f.Status
}

func (b Behavior) delay(random *chance) time.Duration {
	return time.Duration(random.between(b.DelayMs, b.DelayMaxMs)) * time.Millisecond
}

func (b Behavior) slowBody() time.Duration {
	return time.Duration(b.SlowBodyMs) * time.Millisecond
}

func (s Settings) validate() error {
	if err := loopback.CheckPort(s.Port); err != nil {
		return err
	}
	return s.Behavior.validate()
}
