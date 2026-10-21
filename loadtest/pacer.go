package loadtest

import (
	"context"
	"sync/atomic"
	"time"
)

type pacer struct {
	started  time.Time
	interval time.Duration
	reserved atomic.Int64
}

func newPacer(ratePerSecond int, started time.Time) *pacer {
	if ratePerSecond <= 0 {
		return nil
	}
	return &pacer{started: started, interval: time.Second / time.Duration(ratePerSecond)}
}

func (p *pacer) wait(ctx context.Context) bool {
	if p == nil {
		return ctx.Err() == nil
	}
	slot := p.reserved.Add(1) - 1
	return pause(ctx, time.Until(p.started.Add(time.Duration(slot)*p.interval)))
}

func pause(ctx context.Context, length time.Duration) bool {
	if length <= 0 {
		return ctx.Err() == nil
	}
	timer := time.NewTimer(length)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}
