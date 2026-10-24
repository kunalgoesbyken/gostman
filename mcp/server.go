package mcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"slices"
	"sync"
	"time"
)

const (
	concurrentCalls  = 8
	progressInterval = 250 * time.Millisecond
	noArguments      = "{}"
	invalidRequest   = "Invalid request: a message needs \"jsonrpc\": \"2.0\" and a method"
	idInUse          = "Invalid request: a call with this id is still running"
)

type Result struct {
	Value      any
	Text       string
	Structured any
}

type Hints struct {
	ReadOnly    bool
	Destructive bool
	Idempotent  bool
	OpenWorld   bool
}

type Tool struct {
	Name         string
	Title        string
	Description  string
	InputSchema  any
	OutputSchema any
	Hints        Hints
	Handle       func(ctx context.Context, arguments json.RawMessage) (Result, error)
}

type Server struct {
	Name         string
	Version      string
	Instructions string
	Tools        []Tool
	Log          io.Writer

	setup   sync.Once
	slots   chan struct{}
	calls   sync.WaitGroup
	pending sync.Mutex
	cancels map[string]context.CancelFunc
}

type writer func(message any)

type progressKey struct{}

type reporter struct {
	mu       sync.Mutex
	token    json.RawMessage
	write    writer
	reported time.Time
	progress float64
}

func (s *Server) ready() {
	s.setup.Do(func() {
		s.slots = make(chan struct{}, concurrentCalls)
		s.cancels = map[string]context.CancelFunc{}
	})
}

func (s *Server) Serve(ctx context.Context, input io.Reader, output io.Writer) error {
	s.ready()
	var lock sync.Mutex
	write := func(message any) {
		encoded, err := encode(message)
		if err != nil {
			fmt.Fprintf(s.Log, "a reply could not be encoded: %s\n", err)
			return
		}
		lock.Lock()
		defer lock.Unlock()
		if _, err := io.WriteString(output, encoded+"\n"); err != nil {
			fmt.Fprintf(s.Log, "a reply could not be written: %s\n", err)
		}
	}
	err := s.read(ctx, bufio.NewReader(input), write)
	s.calls.Wait()
	return err
}

func (s *Server) read(ctx context.Context, input *bufio.Reader, write writer) error {
	for {
		line, err := input.ReadBytes('\n')
		if len(bytes.TrimSpace(line)) > 0 {
			s.handle(ctx, line, write)
		}
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
	}
}

func respond(write writer, id json.RawMessage, result any) {
	write(Reply{Version: JSONRPCVersion, ID: id, Result: result})
}

func fail(write writer, id json.RawMessage, code int, text string) {
	write(Reply{Version: JSONRPCVersion, ID: id, Error: &Failure{Code: code, Message: text}})
}

func parse(line []byte) (Message, int, string) {
	var incoming Message
	err := json.Unmarshal(line, &incoming)
	var mistyped *json.UnmarshalTypeError
	switch {
	case errors.As(err, &mistyped):
		return incoming, codeInvalidRequest, invalidRequest
	case err != nil:
		return incoming, codeParseError, "Parse error: " + err.Error()
	case incoming.Version != JSONRPCVersion || incoming.Method == "":
		return incoming, codeInvalidRequest, invalidRequest
	default:
		return incoming, 0, ""
	}
}

func (s *Server) handle(ctx context.Context, line []byte, write writer) <-chan struct{} {
	s.ready()
	done := make(chan struct{})
	incoming, code, problem := parse(line)
	switch {
	case code != 0 && incoming.isNotification():
		fail(write, absentID, code, problem)
	case code != 0:
		fail(write, incoming.ID, code, problem)
	case incoming.isNotification():
		s.notice(incoming)
	default:
		if s.dispatch(ctx, incoming, write, done) {
			return done
		}
	}
	close(done)
	return done
}

func (s *Server) dispatch(ctx context.Context, incoming Message, write writer, done chan struct{}) bool {
	stateless, refusal := classify(incoming)
	switch {
	case refusal != nil:
		write(Reply{Version: JSONRPCVersion, ID: incoming.ID, Error: refusal})
	case incoming.Method == MethodCallTool:
		return s.start(ctx, incoming, stateless, write, done)
	default:
		s.answer(incoming, stateless, write)
	}
	return false
}

func supportedVersions() []string {
	return append(append([]string{}, statelessVersions...), ProtocolVersions...)
}

func declaredVersion(incoming Message) (string, map[string]json.RawMessage, bool) {
	var params requestMeta
	json.Unmarshal(incoming.Params, &params)
	raw, declared := params.Meta[metaVersion]
	var version string
	json.Unmarshal(raw, &version)
	return version, params.Meta, declared
}

func classify(incoming Message) (bool, *Failure) {
	version, meta, declared := declaredVersion(incoming)
	if !declared {
		return false, nil
	}
	if !slices.Contains(statelessVersions, version) {
		data, _ := json.Marshal(versionRefusal{Supported: supportedVersions(), Requested: version})
		return true, &Failure{Code: codeUnsupportedVersion, Message: "Unsupported protocol version", Data: data}
	}
	if _, found := meta[metaCapabilities]; !found {
		return true, &Failure{Code: codeInvalidParams, Message: "Invalid params: _meta needs " + metaCapabilities}
	}
	return true, nil
}

func (s *Server) implementation() Implementation {
	return Implementation{Name: s.Name, Version: s.Version}
}

func (s *Server) stamp(result *completion) {
	result.ResultType = resultComplete
	result.Meta = &serverMeta{ServerInfo: s.implementation()}
}

func privateHints() cacheHints {
	fresh := int64(0)
	return cacheHints{TTLMs: &fresh, CacheScope: privateCache}
}

func (s *Server) discover() discoverResult {
	found := discoverResult{cacheHints: privateHints(), SupportedVersions: supportedVersions(), Instructions: s.Instructions}
	s.stamp(&found.completion)
	return found
}

func (s *Server) answer(incoming Message, stateless bool, write writer) {
	switch {
	case incoming.Method == methodDiscover && stateless:
		respond(write, incoming.ID, s.discover())
	case incoming.Method == methodDiscover:
		fail(write, incoming.ID, codeInvalidParams, "Invalid params: server/discover needs _meta with "+metaVersion+" and "+metaCapabilities)
	case incoming.Method == MethodInitialize:
		s.initialize(incoming, write)
	case incoming.Method == MethodPing:
		respond(write, incoming.ID, Empty{})
	case incoming.Method == MethodListTools:
		respond(write, incoming.ID, s.listing(stateless))
	default:
		fail(write, incoming.ID, CodeMethodNotFound, "Method not found: "+incoming.Method)
	}
}

func (s *Server) notice(incoming Message) {
	if incoming.Method != methodCancelled {
		return
	}
	var params cancelParams
	if json.Unmarshal(incoming.Params, &params) != nil {
		return
	}
	s.pending.Lock()
	defer s.pending.Unlock()
	if cancel, ok := s.cancels[string(params.RequestID)]; ok {
		cancel()
	}
}

func (s *Server) initialize(incoming Message, write writer) {
	var params InitializeParams
	if err := json.Unmarshal(incoming.Params, &params); err != nil {
		fail(write, incoming.ID, codeInvalidParams, "Invalid params: "+err.Error())
		return
	}
	respond(write, incoming.ID, InitializeResult{
		ProtocolVersion: negotiate(params.ProtocolVersion),
		ServerInfo:      s.implementation(),
		Instructions:    s.Instructions,
	})
}

func (s *Server) listing(stateless bool) listResult {
	listed := listResult{Tools: make([]toolListing, 0, len(s.Tools))}
	if stateless {
		s.stamp(&listed.completion)
		listed.cacheHints = privateHints()
	}
	for _, tool := range s.Tools {
		listed.Tools = append(listed.Tools, toolListing{
			Name:         tool.Name,
			Title:        tool.Title,
			Description:  tool.Description,
			InputSchema:  tool.InputSchema,
			OutputSchema: tool.OutputSchema,
			Annotations: annotations{
				Title:       tool.Title,
				ReadOnly:    tool.Hints.ReadOnly,
				Destructive: tool.Hints.Destructive,
				Idempotent:  tool.Hints.Idempotent,
				OpenWorld:   tool.Hints.OpenWorld,
			},
		})
	}
	return listed
}

func (s *Server) find(name string) (Tool, bool) {
	for _, tool := range s.Tools {
		if tool.Name == name {
			return tool, true
		}
	}
	return Tool{}, false
}

func withProgress(ctx context.Context, params json.RawMessage, write writer) context.Context {
	var meta callMeta
	if json.Unmarshal(params, &meta) != nil {
		return ctx
	}
	token := meta.Meta.ProgressToken
	if isAbsent(token) {
		return ctx
	}
	return context.WithValue(ctx, progressKey{}, &reporter{token: token, write: write})
}

func Progress(ctx context.Context, progress, total float64, message string) {
	if tracker, ok := ctx.Value(progressKey{}).(*reporter); ok {
		tracker.report(progress, total, message)
	}
}

func (r *reporter) report(progress, total float64, message string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	finished := total > 0 && progress >= total
	if progress <= r.progress || (!finished && time.Since(r.reported) < progressInterval) {
		return
	}
	r.reported, r.progress = time.Now(), progress
	r.write(notification{Version: JSONRPCVersion, Method: methodProgress, Params: progressParams{
		ProgressToken: r.token,
		Progress:      progress,
		Total:         total,
		Message:       message,
	}})
}

func (s *Server) start(ctx context.Context, incoming Message, stateless bool, write writer, done chan struct{}) bool {
	var params CallParams
	if err := json.Unmarshal(incoming.Params, &params); err != nil {
		fail(write, incoming.ID, codeInvalidParams, "Invalid params: "+err.Error())
		return false
	}
	tool, found := s.find(params.Name)
	if !found {
		fail(write, incoming.ID, codeInvalidParams, "Unknown tool: "+params.Name)
		return false
	}
	if isAbsent(params.Arguments) {
		params.Arguments = json.RawMessage(noArguments)
	}
	key := string(incoming.ID)
	scoped, cancel := context.WithCancel(withProgress(ctx, incoming.Params, write))
	s.pending.Lock()
	if _, taken := s.cancels[key]; taken {
		s.pending.Unlock()
		cancel()
		fail(write, incoming.ID, codeInvalidRequest, idInUse)
		return false
	}
	s.cancels[key] = cancel
	s.pending.Unlock()
	s.calls.Add(1)
	go func() {
		defer s.calls.Done()
		defer close(done)
		result := s.perform(scoped, tool, params.Arguments)
		if stateless {
			s.stamp(&result.completion)
		}
		if cancelled := s.release(key, scoped); !cancelled {
			respond(write, incoming.ID, result)
		}
	}()
	return true
}

func (s *Server) perform(ctx context.Context, tool Tool, arguments json.RawMessage) callResult {
	s.slots <- struct{}{}
	defer func() { <-s.slots }()
	if ctx.Err() != nil {
		return toolFailure("The call was cancelled.")
	}
	return s.execute(ctx, tool, arguments)
}

func (s *Server) release(key string, ctx context.Context) bool {
	s.pending.Lock()
	defer s.pending.Unlock()
	cancelled := ctx.Err() != nil
	s.cancels[key]()
	delete(s.cancels, key)
	return cancelled
}

func toolFailure(text string) callResult {
	return callResult{Content: []content{textContent(text)}, IsError: true}
}

func present(tool Tool, result Result) callResult {
	shown := callResult{Content: []content{}}
	if result.Value != nil {
		encoded, err := encode(result.Value)
		if err != nil {
			return toolFailure("The result could not be encoded: " + err.Error())
		}
		shown.Content = append(shown.Content, textContent(encoded))
	}
	if result.Text != "" {
		shown.Content = append(shown.Content, textContent(result.Text))
	}
	if tool.OutputSchema != nil {
		shown.StructuredContent = result.Value
		if result.Structured != nil {
			shown.StructuredContent = result.Structured
		}
	}
	return shown
}

func (s *Server) execute(ctx context.Context, tool Tool, arguments json.RawMessage) (shown callResult) {
	defer func() {
		if crash := recover(); crash != nil {
			fmt.Fprintf(s.Log, "%s stopped unexpectedly: %v\n", tool.Name, crash)
			shown = toolFailure(tool.Name + " stopped unexpectedly; the server is still running.")
		}
	}()
	result, err := tool.Handle(ctx, arguments)
	if err != nil {
		return toolFailure(err.Error())
	}
	return present(tool, result)
}
