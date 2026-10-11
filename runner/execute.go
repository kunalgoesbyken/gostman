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
	cookies   []engine.CookieInfo
	tokens    tokenCache
	witness   func(engine.Request)
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
}

type exchange struct {
	skipped  string
	response engine.Response
	tests    []Check
	logs     []LogLine
	errors   []string
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
}

func (x *exchange) stop(message string) {
	x.response = engine.Failure(engine.ErrorConfig, message)
}

func (s *session) runStage(stage string, work job) stageRun {
	work.Variables = s.variables
	var run stageRun
	if err := s.scripts.Isolated("runJob", &run, work); err != nil {
		return stageRun{Error: stage + ": " + err.Error()}
	}
	if run.Variables != nil {
		s.variables = run.Variables
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

func (s *session) runPreRequest(request Request, outcome *exchange) (Request, bool, error) {
	described, err := s.subject("requestSubject", request)
	if err != nil {
		return request, false, err
	}
	run := s.runStage(preRequest, job{Script: request.PreScript, Request: described})
	outcome.record(run)
	if run.Error != "" {
		outcome.stop(run.Error)
		return request, false, nil
	}
	var edited Request
	if err := s.scripts.Call("applyRequestEdits", &edited, request, run.Request); err != nil {
		return request, false, err
	}
	return edited, true, nil
}

func (s *session) transmit(ctx context.Context, request Request) (engine.Response, error) {
	if request.Method == grpcMethod {
		var call rpc.Call
		if err := s.scripts.Call("toGrpcCall", &call, request, s.variables.text()); err != nil {
			return engine.Response{}, err
		}
		return rpc.Invoke(ctx, call, s.policy), nil
	}
	if request.Method == mcpMethod {
		var call mcpclient.Call
		if err := s.scripts.Call("toMcpCall", &call, request, s.variables.text()); err != nil {
			return engine.Response{}, err
		}
		s.announce(engine.Request{Headers: call.Target.Headers, Auth: call.Target.Auth, Variables: call.Target.Variables})
		return mcpclient.Invoke(ctx, call, s.policy), nil
	}
	var prepared engine.Request
	if err := s.scripts.Call("toEngineRequest", &prepared, request, s.variables.text(), s.cookies); err != nil {
		return engine.Response{}, err
	}
	s.announce(prepared)
	return engine.Send(ctx, prepared, s.policy), nil
}

func (s *session) announce(prepared engine.Request) {
	if s.witness != nil {
		s.witness(prepared)
	}
}

func (s *session) storeCookies(received []engine.CookieInfo) error {
	if len(received) == 0 {
		return nil
	}
	var merged []engine.CookieInfo
	if err := s.scripts.Call("mergeCookies", &merged, s.cookies, received); err != nil {
		return err
	}
	s.cookies = merged
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

func (s *session) needsPostStage(request Request) (bool, error) {
	if hasText(request.PostScript) {
		return true, nil
	}
	var active int
	err := s.scripts.Call("countActiveAssertions", &active, request.Assertions)
	return active > 0, err
}

func (s *session) runPostResponse(request Request, outcome *exchange) error {
	needed, err := s.needsPostStage(request)
	if err != nil || !needed {
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
	outcome.record(s.runStage(postResponse, job{
		Script:     request.PostScript,
		Assertions: request.Assertions,
		Request:    sent,
		Response:   received,
	}))
	return nil
}

func (s *session) isSocket(request Request) (bool, error) {
	var socket bool
	err := s.scripts.Call("isSocketAddress", &socket, request.URL, s.variables.text())
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

	if hasText(request.PreScript) {
		edited, proceed, err := s.runPreRequest(request, &outcome)
		if err != nil || !proceed {
			return outcome, err
		}
		request = edited
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
	return outcome, s.runPostResponse(request, &outcome)
}
