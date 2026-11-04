package runner

import (
	"context"
	"maps"
	"slices"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	branchPassed    = "passed"
	branchFailed    = "failed"
	branchCancelled = "cancelled"
)

type branchInput struct {
	State    string            `json:"state"`
	Response *engine.Response  `json:"response,omitempty"`
	Message  string            `json:"message,omitempty"`
	Ms       int64             `json:"ms"`
	Sends    int               `json:"sends,omitempty"`
	Budget   bool              `json:"budget,omitempty"`
	Outputs  map[string]string `json:"outputs,omitempty"`
}

type branchDone struct {
	step   string
	input  branchInput
	result *Result
	nested *FlowEvent
	sends  int
	held   []flowNote
}

func (r *flowRun) borrow() (*session, func(), error) {
	r.ledger.mu.Lock()
	if count := len(r.ledger.idle); count > 0 {
		worker := r.ledger.idle[count-1]
		r.ledger.idle = r.ledger.idle[:count-1]
		r.ledger.mu.Unlock()
		return worker, r.giveBack(worker), nil
	}
	r.ledger.mu.Unlock()
	worker, err := r.session.spawn()
	if err != nil {
		return nil, nil, err
	}
	return worker, r.giveBack(worker), nil
}

func (r *flowRun) giveBack(worker *session) func() {
	return func() {
		r.ledger.mu.Lock()
		r.ledger.idle = append(r.ledger.idle, worker)
		r.ledger.mu.Unlock()
	}
}

func (r *flowRun) branch(worker *session) *flowRun {
	shared := *r.flowShared
	shared.session = worker
	return &flowRun{
		flowShared: &shared, flow: r.flow, depth: r.depth, given: r.given, sendsLeft: r.sendsLeft, owner: r.home(), concurrent: true, held: &[]flowNote{},
		nested: map[string]*FlowEvent{}, pending: map[string]*Result{},
	}
}

func passedState(passed bool) string {
	if passed {
		return branchPassed
	}
	return branchFailed
}

func (r *flowRun) sendBranch(ctx context.Context, action flowAction) branchDone {
	done := branchDone{step: action.Step}
	request, err := r.filled(r.library[action.RequestID], action.Inputs)
	if err != nil {
		done.input = branchInput{State: branchFailed, Message: err.Error()}
		return done
	}
	result, response := r.send(ctx, action, request)
	done.result = &result
	if result.IsSkipped() {
		done.input = branchInput{State: branchFailed, Message: result.Skipped}
		return done
	}
	done.input = branchInput{State: passedState(!result.Failed && response.Error == ""), Response: &response, Message: result.Error}
	return done
}

func (r *flowRun) flowBranch(ctx context.Context, action flowAction) branchDone {
	input := r.runNested(ctx, action)
	done := branchDone{step: action.Step, nested: r.nested[action.Step]}
	done.input = branchInput{State: passedState(input.Outcome == FlowPassed), Message: input.Message, Sends: input.Sends, Budget: input.Budget, Outputs: input.Outputs}
	return done
}

func (r *flowRun) runBranch(ctx context.Context, action flowAction) branchDone {
	if ctx.Err() != nil {
		return branchDone{step: action.Step, input: branchInput{State: branchCancelled}}
	}
	worker, release, err := r.borrow()
	if err != nil {
		return branchDone{step: action.Step, input: branchInput{State: branchFailed, Message: err.Error()}}
	}
	defer release()
	began := time.Now()
	runner := r.branch(worker)
	var done branchDone
	if action.Kind == flowNested {
		done = runner.flowBranch(ctx, action)
	} else {
		done = runner.sendBranch(ctx, action)
	}
	done.input.Ms = time.Since(began).Milliseconds()
	done.sends, done.held = runner.sends, *runner.held
	if ctx.Err() != nil && done.input.State != branchPassed {
		done.input.State = branchCancelled
	}
	return done
}

func (r *flowRun) keepBranch(done branchDone) {
	r.sends += done.sends
	for _, note := range done.held {
		if note.event != nil {
			r.notify(*note.event)
		} else {
			r.record(*note.result)
		}
	}
	if done.result != nil {
		r.pending[done.step] = done.result
	}
	if done.nested != nil {
		r.nested[done.step] = done.nested
	}
}

func (r *flowRun) parallel(ctx context.Context, turn flowTurn) (flowTurn, error) {
	action := turn.Action
	branchCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	finished := make(chan branchDone, len(action.Branches))
	began := time.Now()
	for _, branch := range action.Branches {
		go func() {
			finished <- r.runBranch(branchCtx, branch)
		}()
	}
	var deadline <-chan time.Time
	if action.TimeoutMs > 0 {
		timer := time.NewTimer(time.Duration(action.TimeoutMs) * time.Millisecond)
		defer timer.Stop()
		deadline = timer.C
	}
	states := map[string]branchInput{}
	var order []string
	stopping, timedOut := false, false
	var failure error
	var doneAt *flowInput
	for remaining := len(action.Branches); remaining > 0; {
		select {
		case done := <-finished:
			remaining--
			r.keepBranch(done)
			states[done.step] = done.input
			order = append(order, done.step)
			if stopping || remaining == 0 {
				continue
			}
			partial := flowInput{Branches: maps.Clone(states), Order: slices.Clone(order), ElapsedMs: time.Since(began).Milliseconds()}
			next, err := r.call("flowAdvance", r.flow, turn.State, partial, r.context())
			if err != nil {
				failure, stopping = err, true
				cancel()
			} else if next.Action.Stop {
				stopping, doneAt = true, &partial
				cancel()
			}
		case <-deadline:
			deadline = nil
			timedOut, stopping = true, true
			cancel()
		}
	}
	r.measure(flowMoment{Step: action.Step}, began)
	if failure != nil {
		return flowTurn{}, failure
	}
	settled := flowInput{Branches: states, Order: order, ElapsedMs: time.Since(began).Milliseconds(), Settled: true, TimedOut: timedOut, DoneAt: doneAt}
	return r.call("flowAdvance", r.flow, turn.State, settled, r.context())
}
