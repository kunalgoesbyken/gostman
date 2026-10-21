package loadtest

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
)

const ResponseBytesReadLimit = 4 << 20

type Plan struct {
	Config  Config
	Request engine.Request
	Policy  engine.Policy
}

type run struct {
	plan      Plan
	sending   context.Context
	issuing   context.Context
	started   time.Time
	pacer     *pacer
	collected *collector
	issued    atomic.Int64
}

func Run(ctx context.Context, plan Plan, observe func(Snapshot)) (Report, error) {
	plan.Config = plan.Config.Normalized()
	if err := plan.Config.Validate(); err != nil {
		return Report{}, err
	}
	if _, err := engine.Prepare(plan.Request); err != nil {
		return Report{}, err
	}
	if plan.Policy.MaxResponseBytes == 0 {
		plan.Policy.MaxResponseBytes = ResponseBytesReadLimit
	}
	issuing, release := issuingContext(ctx, plan.Config)
	defer release()

	started := time.Now()
	current := &run{
		plan:      plan,
		sending:   ctx,
		issuing:   issuing,
		started:   started,
		pacer:     newPacer(plan.Config.RatePerSecond, started),
		collected: newCollector(plan.Config.FailureStatus),
	}
	current.execute(observe)
	return current.collected.report(plan.Config, time.Since(started), ctx.Err() != nil), nil
}

func issuingContext(ctx context.Context, config Config) (context.Context, context.CancelFunc) {
	if config.DurationMs > 0 {
		return context.WithTimeout(ctx, config.Duration())
	}
	return context.WithCancel(ctx)
}

func (r *run) execute(observe func(Snapshot)) {
	finished := make(chan struct{})
	var reporting sync.WaitGroup
	if observe != nil {
		reporting.Add(1)
		go func() {
			defer reporting.Done()
			r.report(finished, observe)
		}()
	}
	var workers sync.WaitGroup
	for index := range r.plan.Config.workers() {
		workers.Add(1)
		go func() {
			defer workers.Done()
			r.work(index)
		}()
	}
	workers.Wait()
	close(finished)
	reporting.Wait()
}

func (r *run) rampDelay(worker int) time.Duration {
	return r.plan.Config.Ramp() * time.Duration(worker) / time.Duration(r.plan.Config.workers())
}

func (r *run) work(worker int) {
	if !pause(r.issuing, r.rampDelay(worker)) {
		return
	}
	for r.claim() {
		r.send()
	}
}

func (r *run) claim() bool {
	if !r.pacer.wait(r.issuing) {
		return false
	}
	limit := int64(r.plan.Config.Requests)
	return limit == 0 || r.issued.Add(1) <= limit
}

func (r *run) send() {
	begun := time.Now()
	outcome := engine.Send(r.sending, r.plan.Request, r.plan.Policy)
	if r.sending.Err() != nil {
		return
	}
	r.collected.record(sample{latency: time.Since(begun), outcome: outcome})
}

func (r *run) report(finished <-chan struct{}, observe func(Snapshot)) {
	ticker := time.NewTicker(ProgressInterval)
	defer ticker.Stop()
	previousAt, previousTotal := r.started, int64(0)
	for {
		select {
		case <-finished:
			return
		case now := <-ticker.C:
			total, failed, p95 := r.collected.snapshot()
			observe(Snapshot{
				ElapsedMs:         now.Sub(r.started).Milliseconds(),
				Total:             total,
				Failed:            failed,
				RequestsPerSecond: float64(total-previousTotal) / now.Sub(previousAt).Seconds(),
				P95Ms:             toMs(p95),
			})
			previousAt, previousTotal = now, total
		}
	}
}
