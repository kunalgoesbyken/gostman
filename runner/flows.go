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
	FlowPassed  = "passed"
	FlowFailed  = "failed"
	FlowHandled = "handled"

	flowSend         = "send"
	flowWait         = "wait"
	flowDone         = "done"
	flowNested       = "flow"
	flowStepRequest  = "request"
	flowStepFlow     = "flow"
	flowEventRunning = "running"
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
	Depth     int               `json:"depth,omitempty"`
	Steps     []FlowEvent       `json:"steps,omitempty"`
	Index     *int              `json:"index,omitempty"`
}

type FlowReport struct {
	Name    string       `json:"name"`
	Outcome string       `json:"outcome"`
	Message string       `json:"message"`
	Steps   []FlowEvent  `json:"steps"`
	Metrics *FlowMetrics `json:"metrics,omitempty"`
}

type FlowMetrics struct {
	TotalMs       int64                  `json:"totalMs"`
	Sends         int                    `json:"sends"`
	BytesSent     int64                  `json:"bytesSent"`
	BytesReceived int64                  `json:"bytesReceived"`
	Steps         map[string]StepMetrics `json:"steps"`
}

type StepMetrics struct {
	Title   string `json:"title,omitempty"`
	Kind    string `json:"kind,omitempty"`
	Count   int    `json:"count"`
	TotalMs int64  `json:"totalMs"`
	MinMs   int64  `json:"minMs"`
	MaxMs   int64  `json:"maxMs"`
}

type flowMoment struct {
	Events   []FlowEvent `json:"events,omitempty"`
	Step     string      `json:"step,omitempty"`
	Ms       int64       `json:"ms"`
	Sent     int64       `json:"sent"`
	Received int64       `json:"received"`
	Send     bool        `json:"send,omitempty"`
}

type FlowWatch struct {
	Result func(Result)
	Step   func(FlowEvent)
}

type flowAction struct {
	Kind      string            `json:"kind"`
	Step      string            `json:"step"`
	RequestID string            `json:"requestId"`
	FlowID    string            `json:"flowId"`
	Title     string            `json:"title"`
	SendsLeft int               `json:"sendsLeft"`
	Attempt   int               `json:"attempt"`
	Attempts  int               `json:"attempts"`
	DelayMs   int64             `json:"delayMs"`
	Ms        int64             `json:"ms"`
	Variables map[string]string `json:"variables"`
	Inputs    json.RawMessage   `json:"inputs"`
	Outcome   string            `json:"outcome"`
	Message   string            `json:"message"`
	Budget    bool              `json:"budget"`
}

type flowTurn struct {
	State    json.RawMessage   `json:"state"`
	Action   flowAction        `json:"action"`
	Events   []FlowEvent       `json:"events"`
	Writes   map[string]string `json:"writes"`
	Problems []json.RawMessage `json:"problems"`
}

type flowRequest struct {
	ID       string `json:"id"`
	Path     string `json:"path"`
	Name     string `json:"name"`
	BodyType string `json:"bodyType"`
}

type filledRequest struct {
	Ok      bool    `json:"ok"`
	Request Request `json:"request"`
	Message string  `json:"message"`
}

type flowContext struct {
	Requests  []flowRequest     `json:"requests"`
	Flows     []workspace.Flow  `json:"flows"`
	Variables map[string]string `json:"variables"`
	SendsLeft *int              `json:"sendsLeft,omitempty"`
}

type flowInput struct {
	Response *engine.Response `json:"response,omitempty"`
	Failed   bool             `json:"failed"`
	Outcome  string           `json:"outcome,omitempty"`
	Message  string           `json:"message,omitempty"`
	Sends    int              `json:"sends,omitempty"`
	Budget   bool             `json:"budget,omitempty"`
	Unfilled *string          `json:"unfilled,omitempty"`
}

type flowShared struct {
	session *session
	options Options
	watch   FlowWatch
	library map[string]Request
	folders map[string]string
	catalog []flowRequest
	flows   []workspace.Flow
	results []Result
}

type flowRun struct {
	*flowShared
	flow      workspace.Flow
	depth     int
	given     map[string]string
	sendsLeft *int
	sends     int
	steps     []FlowEvent
	nested    *FlowEvent
	pending   *Result
	timeline  []flowMoment
	owner     *flowRun
}

func (s *Session) RunFlow(ctx context.Context, stored Collection, flow workspace.Flow, options Options, watch FlowWatch) (Report, error) {
	planned, err := s.setUp(stored, Options{Secrets: options.Secrets, Variables: options.Variables, SignIn: options.SignIn, Contract: options.Contract, Timeout: options.Timeout, Insecure: options.Insecure, StreamTimeout: options.StreamTimeout})
	if err != nil {
		return Report{}, err
	}
	run := newFlowRun(s.state, stored.Flows, flow, planned, options, watch)
	started := time.Now()
	first, err := run.call("flowBegin", run.flow, run.context())
	if err == nil && len(first.Problems) > 0 {
		return Report{}, errors.New(first.Action.Message)
	}
	done := run.drive(ctx, first, err)
	duration := time.Since(started).Milliseconds()
	report := Report{
		Version:     ReportVersion,
		Environment: s.state.values.environmentNames(),
		StartedAt:   started.UTC(),
		DurationMs:  duration,
		Flow:        &FlowReport{Name: flow.Name, Outcome: done.Outcome, Message: done.Message, Steps: run.steps, Metrics: run.metrics(duration)},
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

func newFlowRun(state *session, flows []workspace.Flow, flow workspace.Flow, planned plan, options Options, watch FlowWatch) *flowRun {
	shared := &flowShared{session: state, options: options, watch: watch, library: map[string]Request{}, folders: planned.folderNames, flows: flows}
	for _, request := range planned.requests {
		shared.library[request.ID] = request
		listed := Listed{Request: request, Folder: planned.folderNames[request.FolderID]}
		shared.catalog = append(shared.catalog, flowRequest{ID: request.ID, Path: listed.QualifiedName(), Name: request.Name, BodyType: request.BodyType})
	}
	return &flowRun{flowShared: shared, flow: flow}
}

func (r *flowRun) context() flowContext {
	variables := r.session.values.current().plain()
	maps.Copy(variables, r.given)
	return flowContext{Requests: r.catalog, Flows: r.flows, Variables: variables, SendsLeft: r.sendsLeft}
}

func (r *flowRun) call(function string, arguments ...any) (flowTurn, error) {
	var turn flowTurn
	err := r.session.scripts.Call(function, &turn, arguments...)
	return turn, err
}

func (r *flowRun) drive(ctx context.Context, turn flowTurn, err error) flowAction {
	for {
		if err != nil {
			return r.halt(err.Error())
		}
		r.session.values.remember(turn.Writes)
		for name := range turn.Writes {
			delete(r.given, name)
		}
		r.absorb(turn.Events)
		if turn.Action.Kind == flowDone {
			return turn.Action
		}
		input := r.perform(ctx, turn.Action)
		if ctx.Err() != nil {
			return r.halt(flowStopped)
		}
		turn, err = r.call("flowAdvance", r.flow, turn.State, input, r.context())
	}
}

func (r *flowRun) metrics(totalMs int64) *FlowMetrics {
	var metrics FlowMetrics
	if err := r.session.scripts.Call("flowMetrics", &metrics, r.flow, r.timeline, totalMs); err != nil {
		return nil
	}
	return &metrics
}

func (r *flowRun) halt(message string) flowAction {
	r.flush(message)
	return flowAction{Kind: flowDone, Outcome: FlowFailed, Message: message}
}

func (r *flowRun) measure(moment flowMoment, began time.Time) {
	moment.Ms = time.Since(began).Milliseconds()
	if r.owner != nil {
		moment.Step = ""
		r.owner.timeline = append(r.owner.timeline, moment)
		return
	}
	r.timeline = append(r.timeline, moment)
}

func (r *flowRun) child(called workspace.Flow, given map[string]string, sendsLeft *int) *flowRun {
	child := &flowRun{flowShared: r.flowShared, flow: called, depth: r.depth + 1, given: given, sendsLeft: sendsLeft, owner: r.owner}
	if child.owner == nil {
		child.owner = r
	}
	return child
}

func requestBytes(response engine.Response) int64 {
	if response.Timeline == nil {
		return 0
	}
	var total int64
	for _, hop := range response.Timeline.Hops {
		total += hop.RequestBytes
	}
	return total
}

func (r *flowRun) perform(ctx context.Context, action flowAction) flowInput {
	if action.Kind == flowNested {
		return r.runNested(ctx, action)
	}
	if action.Kind == flowWait {
		began := time.Now()
		pause(ctx, time.Duration(action.Ms)*time.Millisecond)
		r.measure(flowMoment{Step: action.Step}, began)
		return flowInput{}
	}
	if action.DelayMs > 0 {
		pause(ctx, time.Duration(action.DelayMs)*time.Millisecond)
	}
	if ctx.Err() != nil {
		return flowInput{}
	}
	request, err := r.filled(r.library[action.RequestID], action.Inputs)
	if err != nil {
		message := err.Error()
		return flowInput{Unfilled: &message}
	}
	result, response := r.send(ctx, action, request)
	r.pending = &result
	if result.IsSkipped() {
		return flowInput{Failed: result.Failed}
	}
	return flowInput{Response: &response, Failed: result.Failed}
}

func (r *flowRun) findFlow(id string) (workspace.Flow, bool) {
	for _, flow := range r.flows {
		if flow.Id == id {
			return flow, true
		}
	}
	return workspace.Flow{}, false
}

func (r *flowRun) runNested(ctx context.Context, action flowAction) flowInput {
	called, found := r.findFlow(action.FlowID)
	if !found {
		return flowInput{Outcome: FlowFailed, Message: fmt.Sprintf("there is no flow with the id %q", action.FlowID)}
	}
	given := maps.Clone(r.given)
	if given == nil {
		given = map[string]string{}
	}
	maps.Copy(given, action.Variables)
	left := action.SendsLeft
	child := r.child(called, given, &left)
	if r.watch.Step != nil {
		r.watch.Step(FlowEvent{Step: action.Step, Kind: flowStepFlow, Title: action.Title, Status: flowEventRunning, Summary: fmt.Sprintf("Runs the flow %q.", called.Name), Depth: r.depth})
	}
	began := time.Now()
	first, err := child.call("flowBegin", child.flow, child.context())
	done := child.drive(ctx, first, err)
	r.measure(flowMoment{Step: action.Step}, began)
	r.nested = &FlowEvent{Step: action.Step, Kind: flowStepFlow, Title: action.Title, Depth: r.depth, Steps: child.steps}
	r.sends += child.sends
	return flowInput{Outcome: done.Outcome, Message: done.Message, Budget: done.Budget, Sends: child.sends}
}

func (r *flowRun) filled(request Request, inputs json.RawMessage) (Request, error) {
	if len(inputs) == 0 || string(inputs) == "null" {
		return request, nil
	}
	var filled filledRequest
	if err := r.session.scripts.Call("applyInputs", &filled, request, inputs); err != nil {
		return request, err
	}
	if !filled.Ok {
		return request, errors.New(filled.Message)
	}
	filled.Request.Lineage = request.Lineage
	return filled.Request, nil
}

func (r *flowRun) exchange(ctx context.Context, request Request, action flowAction) (exchange, error) {
	began := time.Now()
	r.session.once = variables{}
	r.session.once.override(r.given)
	r.session.once.override(action.Variables)
	exchanged, err := r.session.execute(ctx, request)
	r.session.once = nil
	r.session.common.publish(r.session.scoped(request).plain())
	if exchanged.skipped == "" {
		r.measure(flowMoment{Step: action.Step, Sent: requestBytes(exchanged.response), Received: exchanged.response.Size, Send: true}, began)
	}
	return exchanged, err
}

func (r *flowRun) send(ctx context.Context, action flowAction, filled Request) (Result, engine.Response) {
	folder := r.folders[r.library[action.RequestID].FolderID]
	r.sends++
	request := r.options.applyTo(filled)
	exchanged, err := r.exchange(ctx, request, action)
	if err != nil {
		exchanged.stop(err.Error())
	}
	result := describe(request, folder, exchanged)
	result.ResolvedURL = r.session.shownURL(request, exchanged.response.URL)
	if r.options.Capture && !result.IsSkipped() {
		result.Exchange = capture(request, exchanged.response)
	}
	result.Step, result.Attempt, result.Attempts = action.Step, action.Attempt, action.Attempts
	if r.depth > 0 {
		result.Depth, result.InFlow = r.depth, r.flow.Name
	}
	return result, exchanged.response
}

func (r *flowRun) absorb(events []FlowEvent) {
	if len(events) > 0 && r.owner == nil {
		r.timeline = append(r.timeline, flowMoment{Events: events})
	}
	for _, event := range events {
		event.Depth = r.depth
		if event.Kind == flowStepFlow && r.nested != nil && event.Step == r.nested.Step {
			event.Steps, r.nested = r.nested.Steps, nil
		}
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
	if event.Status == FlowHandled {
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

func (r *flowRun) flush(message string) {
	if r.pending != nil {
		result := *r.pending
		r.pending = nil
		r.record(result)
	}
	if r.nested != nil {
		stopped := *r.nested
		r.nested = nil
		stopped.Status, stopped.Summary = FlowFailed, message
		r.steps = append(r.steps, stopped)
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
