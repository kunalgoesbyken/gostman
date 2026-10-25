package runner

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	FlowPassed = "passed"
	FlowFailed = "failed"

	flowSend         = "send"
	flowWait         = "wait"
	flowDone         = "done"
	flowStepRequest  = "request"
	flowEventHandled = "handled"
	flowStopped      = "The flow was stopped before it reached its end."
)

type FlowEvent struct {
	Step      string            `json:"step"`
	Kind      string            `json:"kind"`
	Title     string            `json:"title"`
	Status    string            `json:"status"`
	Summary   string            `json:"summary"`
	Branch    string            `json:"branch,omitempty"`
	Attempt   int               `json:"attempt,omitempty"`
	Attempts  int               `json:"attempts,omitempty"`
	HandledBy string            `json:"handledBy,omitempty"`
	Checks    []Check           `json:"checks,omitempty"`
	Writes    map[string]string `json:"writes,omitempty"`
}

type FlowReport struct {
	Name    string      `json:"name"`
	Outcome string      `json:"outcome"`
	Message string      `json:"message"`
	Steps   []FlowEvent `json:"steps"`
}

type FlowWatch struct {
	Result func(Result)
	Step   func(FlowEvent)
}

type flowAction struct {
	Kind      string            `json:"kind"`
	Step      string            `json:"step"`
	RequestID string            `json:"requestId"`
	Attempt   int               `json:"attempt"`
	Attempts  int               `json:"attempts"`
	DelayMs   int64             `json:"delayMs"`
	Ms        int64             `json:"ms"`
	Variables map[string]string `json:"variables"`
	Outcome   string            `json:"outcome"`
	Message   string            `json:"message"`
}

type flowTurn struct {
	State    json.RawMessage   `json:"state"`
	Action   flowAction        `json:"action"`
	Events   []FlowEvent       `json:"events"`
	Writes   map[string]string `json:"writes"`
	Problems []json.RawMessage `json:"problems"`
}

type flowRequest struct {
	ID   string `json:"id"`
	Path string `json:"path"`
	Name string `json:"name"`
}

type flowContext struct {
	Requests  []flowRequest     `json:"requests"`
	Variables map[string]string `json:"variables"`
}

type flowInput struct {
	Response *engine.Response `json:"response,omitempty"`
	Failed   bool             `json:"failed"`
}

type flowRun struct {
	session  *session
	flow     workspace.Flow
	options  Options
	watch    FlowWatch
	library  map[string]Request
	folders  map[string]string
	catalog  []flowRequest
	results  []Result
	steps    []FlowEvent
	pending  *Result
	finished bool
}

func (s *Session) RunFlow(ctx context.Context, stored Collection, flow workspace.Flow, options Options, watch FlowWatch) (Report, error) {
	planned, err := s.setUp(stored, Options{Secrets: options.Secrets, Variables: options.Variables, SignIn: options.SignIn, Contract: options.Contract, Timeout: options.Timeout, Insecure: options.Insecure, StreamTimeout: options.StreamTimeout})
	if err != nil {
		return Report{}, err
	}
	run := newFlowRun(s.state, flow, planned, options, watch)
	started := time.Now()
	first, err := run.call("flowBegin", run.flow, run.context())
	if err == nil && len(first.Problems) > 0 {
		return Report{}, errors.New(first.Action.Message)
	}
	outcome, message := run.drive(ctx, first, err)
	report := Report{
		Version:     ReportVersion,
		Environment: s.state.values.environmentNames(),
		StartedAt:   started.UTC(),
		DurationMs:  time.Since(started).Milliseconds(),
		Flow:        &FlowReport{Name: flow.Name, Outcome: outcome, Message: message, Steps: run.steps},
		Summary:     flowSummary(run.results),
		Results:     run.results,
	}
	return report, nil
}

func flowSummary(results []Result) Summary {
	summary := summarize(results, len(results))
	summary.NotRun = 0
	return summary
}

func newFlowRun(state *session, flow workspace.Flow, planned plan, options Options, watch FlowWatch) *flowRun {
	run := &flowRun{session: state, flow: flow, options: options, watch: watch, library: map[string]Request{}, folders: planned.folderNames}
	for _, request := range planned.requests {
		run.library[request.ID] = request
		listed := Listed{Request: request, Folder: planned.folderNames[request.FolderID]}
		run.catalog = append(run.catalog, flowRequest{ID: request.ID, Path: listed.QualifiedName(), Name: request.Name})
	}
	return run
}

func (r *flowRun) context() flowContext {
	return flowContext{Requests: r.catalog, Variables: r.session.values.current().plain()}
}

func (r *flowRun) call(function string, arguments ...any) (flowTurn, error) {
	var turn flowTurn
	err := r.session.scripts.Call(function, &turn, arguments...)
	return turn, err
}

func (r *flowRun) drive(ctx context.Context, turn flowTurn, err error) (string, string) {
	for {
		if err != nil {
			r.flush()
			return FlowFailed, err.Error()
		}
		r.session.values.remember(turn.Writes)
		r.absorb(turn.Events)
		if turn.Action.Kind == flowDone {
			return turn.Action.Outcome, turn.Action.Message
		}
		input := r.perform(ctx, turn.Action)
		if ctx.Err() != nil {
			r.flush()
			return FlowFailed, flowStopped
		}
		turn, err = r.call("flowAdvance", r.flow, turn.State, input, r.context())
	}
}

func (r *flowRun) perform(ctx context.Context, action flowAction) flowInput {
	if action.Kind == flowWait {
		pause(ctx, time.Duration(action.Ms)*time.Millisecond)
		return flowInput{}
	}
	if action.DelayMs > 0 {
		pause(ctx, time.Duration(action.DelayMs)*time.Millisecond)
	}
	if ctx.Err() != nil {
		return flowInput{}
	}
	result, response := r.send(ctx, action)
	r.pending = &result
	if result.IsSkipped() {
		return flowInput{Failed: result.Failed}
	}
	return flowInput{Response: &response, Failed: result.Failed}
}

func (r *flowRun) send(ctx context.Context, action flowAction) (Result, engine.Response) {
	request := r.options.applyTo(r.library[action.RequestID])
	folder := r.folders[request.FolderID]
	r.session.once = variables{}
	r.session.once.override(action.Variables)
	exchanged, err := r.session.execute(ctx, request)
	r.session.once = nil
	r.session.common.publish(r.session.scoped(request).plain())
	if err != nil {
		exchanged.stop(err.Error())
	}
	result := describe(request, folder, exchanged)
	result.ResolvedURL = r.session.shownURL(request, exchanged.response.URL)
	if r.options.Capture && !result.IsSkipped() {
		result.Exchange = capture(request, exchanged.response)
	}
	result.Step, result.Attempt, result.Attempts = action.Step, action.Attempt, action.Attempts
	return result, exchanged.response
}

func (r *flowRun) absorb(events []FlowEvent) {
	for _, event := range events {
		r.steps = append(r.steps, event)
		if event.Kind == flowStepRequest && r.pending != nil && r.pending.Step == event.Step {
			r.settle(event)
			continue
		}
		if r.watch.Step != nil {
			r.watch.Step(event)
		}
	}
}

func (r *flowRun) settle(event FlowEvent) {
	result := *r.pending
	r.pending = nil
	if event.Status == flowEventHandled {
		result.Handled = event.Summary
	}
	for _, check := range event.Checks {
		result.Tests = append(result.Tests, check)
		if !check.Passed && result.Handled == "" {
			result.Failed = true
		}
	}
	r.record(result)
}

func (r *flowRun) flush() {
	if r.pending != nil {
		result := *r.pending
		r.pending = nil
		r.record(result)
	}
}

func (r *flowRun) record(result Result) {
	r.results = append(r.results, result)
	if r.watch.Result != nil {
		r.watch.Result(result)
	}
}

func FindFlow(flows []workspace.Flow, reference string) (workspace.Flow, error) {
	matchers := []func(workspace.Flow) bool{
		func(flow workspace.Flow) bool { return flow.Id == reference },
		func(flow workspace.Flow) bool { return flow.Name == reference },
		func(flow workspace.Flow) bool { return strings.EqualFold(flow.Name, reference) },
	}
	for _, matches := range matchers {
		found := filterFlows(flows, matches)
		if len(found) == 1 {
			return found[0], nil
		}
		if len(found) > 1 {
			return workspace.Flow{}, fmt.Errorf("%q matches several flows; use its id", reference)
		}
	}
	return workspace.Flow{}, missingFlow(flows, reference)
}

func filterFlows(flows []workspace.Flow, matches func(workspace.Flow) bool) []workspace.Flow {
	var found []workspace.Flow
	for _, flow := range flows {
		if matches(flow) {
			found = append(found, flow)
		}
	}
	return found
}

func missingFlow(flows []workspace.Flow, reference string) error {
	if len(flows) == 0 {
		return fmt.Errorf("there is no flow named %q: the collection has no flows", reference)
	}
	names := map[string]bool{}
	for _, flow := range flows {
		names[flow.Name] = true
	}
	return fmt.Errorf("there is no flow named %q; the collection has %s", reference, strings.Join(slices.Sorted(maps.Keys(names)), ", "))
}

func RunFlow(ctx context.Context, stored Collection, flow workspace.Flow, options Options, watch FlowWatch) (Report, error) {
	session, err := NewSession(engine.Policy{Network: options.Network, ReadFile: options.Files})
	if err != nil {
		return Report{}, err
	}
	if err := session.Enter(stored, "", options.Environment, options.Variables); err != nil {
		return Report{}, err
	}
	return session.RunFlow(ctx, stored, flow, options, watch)
}
