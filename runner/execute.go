package runner

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/mcpclient"
	"github.com/krockxz/gostman/rpc"
	"github.com/krockxz/gostman/runner/sandbox"
)

const (
	grpcMethod    = "GRPC"
	mcpMethod     = "MCP"
	preRequest    = "Pre-request script"
	postResponse  = "Post-response script"
	skippedSocket = "WebSocket requests are not part of a run."
)

type session struct {
	scripts   *sandbox.Sandbox
	policy    engine.Policy
	variables variables
	common    *shared
	library   []Request
	hosts     []string
}

type job struct {
	Script     string          `json:"script"`
	Assertions string          `json:"assertions"`
	Request    json.RawMessage `json:"request"`
	Response   json.RawMessage `json:"response,omitempty"`
	Variables  variables       `json:"variables"`
}

type stageRun struct {
	Tests     []Check         `json:"tests"`
	Logs      []LogLine       `json:"logs"`
	Error     string          `json:"error"`
	Variables variables       `json:"variables"`
	Request   json.RawMessage `json:"request"`
	Flow      flow            `json:"flow"`
	Visual    string          `json:"visualization"`
}

type exchange struct {
	skipped  string
	response engine.Response
	tests    []Check
	logs     []LogLine
	errors   []string
	flow     flow
	visual   string
}

func hasText(text string) bool {
	return strings.TrimSpace(text) != ""
}

func (x *exchange) record(run stageRun) {
	x.tests = append(x.tests, run.Tests...)
	x.logs = append(x.logs, run.Logs...)
	if run.Error != "" {
		x.errors = append(x.errors, run.Error)
	}
	if run.Flow.Action != "" {
		x.flow = run.Flow
	}
	if run.Visual != "" {
		x.visual = run.Visual
	}
}

func (x *exchange) stop(message string) {
	x.response = engine.Failure(engine.ErrorConfig, message)
}

func (s *session) scoped(request Request) variables {
	scopes := append([]variables{s.variables}, request.folderScopes()...)
	return layered(append(scopes, requestScope(request.Vars))...)
}

func (s *session) runStage(ctx context.Context, stage string, work job, request Request) stageRun {
	before := s.scoped(request)
	work.Variables = before
	var run stageRun
	if err := s.scripts.IsolatedWith(s.bridge(ctx), "runJob", &run, work); err != nil {
		return stageRun{Error: stage + ": " + err.Error()}
	}
	if run.Variables != nil {
		s.variables.update(before, run.Variables)
	}
	if run.Error != "" {
		run.Error = stage + ": " + run.Error
	}
	return run
}

func (s *session) subject(function string, source any) (json.RawMessage, error) {
	var described json.RawMessage
	err := s.scripts.Call(function, &described, source)
	return described, err
}

func (s *session) runPreRequest(ctx context.Context, request Request, scripted step, outcome *exchange) (Request, bool, error) {
	described, err := s.subject("requestSubject", request)
	if err != nil {
		return request, false, err
	}
	run := s.runStage(ctx, scripted.label, job{Script: scripted.script, Request: described}, request)
	outcome.record(run)
	if run.Error != "" {
		outcome.stop(run.Error)
		return request, false, nil
	}
	var edited Request
	if err := s.scripts.Call("applyRequestEdits", &edited, request, run.Request); err != nil {
		return request, false, err
	}
	edited.Lineage = request.Lineage
	return edited, true, nil
}

func (s *session) runPreRequests(ctx context.Context, request Request, outcome *exchange) (Request, bool, error) {
	for _, scripted := range request.preSteps() {
		edited, proceed, err := s.runPreRequest(ctx, request, scripted, outcome)
		if err != nil || !proceed {
			return request, false, err
		}
		request = edited
	}
	return request, true, nil
}

func (s *session) transmit(ctx context.Context, request Request) (engine.Response, error) {
	if request.Method == grpcMethod {
		var call rpc.Call
		if err := s.scripts.Call("toGrpcCall", &call, request, s.scoped(request).text()); err != nil {
			return engine.Response{}, err
		}
		call.Target.Inherited = request.layers()
		return rpc.Invoke(ctx, call, s.policy), nil
	}
	if request.Method == mcpMethod {
		var call mcpclient.Call
		if err := s.scripts.Call("toMcpCall", &call, request, s.scoped(request).text()); err != nil {
			return engine.Response{}, err
		}
		call.Target.Inherited = request.layers()
		s.announce(engine.Request{Headers: call.Target.Headers, Auth: call.Target.Auth, Variables: call.Target.Variables, Inherited: call.Target.Inherited})
		return mcpclient.Invoke(ctx, call, s.policy), nil
	}
	var prepared engine.Request
	if err := s.scripts.Call("toEngineRequest", &prepared, request, s.scoped(request).text(), s.common.cookieList()); err != nil {
		return engine.Response{}, err
	}
	prepared.Inherited = request.layers()
	s.announce(prepared)
	return engine.Send(ctx, prepared, s.policy), nil
}

func (s *session) announce(prepared engine.Request) {
	if resolved, err := engine.Resolve(prepared); err == nil {
		prepared = resolved
	}
	s.common.announce(prepared)
}

func (s *session) storeCookies(received []engine.CookieInfo) error {
	if len(received) == 0 {
		return nil
	}
	s.common.mu.Lock()
	defer s.common.mu.Unlock()
	var merged []engine.CookieInfo
	if err := s.scripts.Call("mergeCookies", &merged, s.common.cookies, received); err != nil {
		return err
	}
	s.common.cookies = merged
	return nil
}

func (s *session) extract(request Request, response engine.Response) error {
	if !hasText(request.Extractors) {
		return nil
	}
	var extracted variables
	if err := s.scripts.Call("extract", &extracted, request, response); err != nil {
		return err
	}
	s.variables.merge(extracted)
	return nil
}

func (s *session) isWorthRunning(scripted step) (bool, error) {
	if hasText(scripted.script) {
		return true, nil
	}
	var active int
	err := s.scripts.Call("countActiveAssertions", &active, scripted.assertions)
	return active > 0, err
}

func (s *session) postSteps(request Request) ([]step, error) {
	var steps []step
	for _, scripted := range request.postSteps() {
		worthRunning, err := s.isWorthRunning(scripted)
		if err != nil {
			return nil, err
		}
		if worthRunning {
			steps = append(steps, scripted)
		}
	}
	return steps, nil
}

func (s *session) runPostResponse(ctx context.Context, request Request, outcome *exchange) error {
	steps, err := s.postSteps(request)
	if err != nil || len(steps) == 0 {
		return err
	}
	sent, err := s.subject("requestSubject", request)
	if err != nil {
		return err
	}
	received, err := s.subject("responseSubject", outcome.response)
	if err != nil {
		return err
	}
	for _, scripted := range steps {
		outcome.record(s.runStage(ctx, scripted.label, job{
			Script:     scripted.script,
			Assertions: scripted.assertions,
			Request:    sent,
			Response:   received,
		}, request))
	}
	return nil
}

func (s *session) isSocket(request Request) (bool, error) {
	var socket bool
	err := s.scripts.Call("isSocketAddress", &socket, request.URL, s.scoped(request).text())
	return socket, err
}

func (s *session) execute(ctx context.Context, request Request) (exchange, error) {
	var outcome exchange
	socket, err := s.isSocket(request)
	if err != nil {
		return outcome, err
	}
	if socket {
		outcome.skipped = skippedSocket
		return outcome, nil
	}

	request, proceed, err := s.runPreRequests(ctx, request, &outcome)
	if err != nil || !proceed {
		return outcome, err
	}
	if outcome.flow.holdsBack() {
		outcome.skipped = outcome.flow.reason()
		return outcome, nil
	}

	request, err = s.withFreshToken(ctx, request)
	if err != nil {
		outcome.stop(err.Error())
		return outcome, nil
	}

	outcome.response, err = s.transmit(ctx, request)
	if err != nil {
		return outcome, err
	}
	if err := s.storeCookies(outcome.response.Cookies); err != nil {
		return outcome, err
	}
	if outcome.response.Error != "" {
		return outcome, nil
	}
	if err := s.extract(request, outcome.response); err != nil {
		return outcome, err
	}
	return outcome, s.runPostResponse(ctx, request, &outcome)
}
