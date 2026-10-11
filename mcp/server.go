package mcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sync"
)

const (
	queueDepth     = 64
	noArguments    = "{}"
	invalidRequest = "Invalid request: a message needs \"jsonrpc\": \"2.0\" and a method"
)

type Result struct {
	Value any
	Text  string
}

type Tool struct {
	Name        string
	Description string
	InputSchema any
	ReadOnly    bool
	Handle      func(ctx context.Context, arguments json.RawMessage) (Result, error)
}

type Server struct {
	Name         string
	Version      string
	Instructions string
	Tools        []Tool
	Log          io.Writer

	writing sync.Mutex
	output  io.Writer
	pending sync.Mutex
	cancels map[string]context.CancelFunc
}

type call struct {
	ctx       context.Context
	id        json.RawMessage
	tool      Tool
	arguments json.RawMessage
}

func (s *Server) Serve(ctx context.Context, input io.Reader, output io.Writer) error {
	s.output = output
	s.cancels = map[string]context.CancelFunc{}
	queue := make(chan call, queueDepth)
	finished := make(chan struct{})
	go func() {
		defer close(finished)
		for queued := range queue {
			s.perform(queued)
		}
	}()
	err := s.read(ctx, bufio.NewReader(input), queue)
	close(queue)
	<-finished
	return err
}

func (s *Server) read(ctx context.Context, input *bufio.Reader, queue chan<- call) error {
	for {
		line, err := input.ReadBytes('\n')
		if len(bytes.TrimSpace(line)) > 0 {
			s.receive(ctx, line, queue)
		}
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
	}
}

func (s *Server) send(answer reply) {
	answer.Version = jsonrpcVersion
	encoded, err := encode(answer)
	if err != nil {
		fmt.Fprintf(s.Log, "a reply could not be encoded: %s\n", err)
		return
	}
	s.writing.Lock()
	defer s.writing.Unlock()
	if _, err := io.WriteString(s.output, encoded+"\n"); err != nil {
		fmt.Fprintf(s.Log, "a reply could not be written: %s\n", err)
	}
}

func (s *Server) respond(id json.RawMessage, result any) {
	s.send(reply{ID: id, Result: result})
}

func (s *Server) fail(id json.RawMessage, code int, text string) {
	s.send(reply{ID: id, Error: &failure{Code: code, Message: text}})
}

func parse(line []byte) (message, int, string) {
	var incoming message
	err := json.Unmarshal(line, &incoming)
	var mistyped *json.UnmarshalTypeError
	switch {
	case errors.As(err, &mistyped):
		return incoming, codeInvalidRequest, invalidRequest
	case err != nil:
		return incoming, codeParseError, "Parse error: " + err.Error()
	case incoming.Version != jsonrpcVersion || incoming.Method == "":
		return incoming, codeInvalidRequest, invalidRequest
	default:
		return incoming, 0, ""
	}
}

func (s *Server) receive(ctx context.Context, line []byte, queue chan<- call) {
	incoming, code, problem := parse(line)
	if code != 0 {
		id := absentID
		if !incoming.isNotification() {
			id = incoming.ID
		}
		s.fail(id, code, problem)
		return
	}
	if incoming.isNotification() {
		s.notice(incoming)
		return
	}
	switch incoming.Method {
	case methodInitialize:
		s.initialize(incoming)
	case methodPing:
		s.respond(incoming.ID, empty{})
	case methodListTools:
		s.respond(incoming.ID, s.listing())
	case methodCallTool:
		s.enqueue(ctx, incoming, queue)
	default:
		s.fail(incoming.ID, codeMethodNotFound, "Method not found: "+incoming.Method)
	}
}

func (s *Server) notice(incoming message) {
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

func (s *Server) initialize(incoming message) {
	var params initializeParams
	if err := json.Unmarshal(incoming.Params, &params); err != nil {
		s.fail(incoming.ID, codeInvalidParams, "Invalid params: "+err.Error())
		return
	}
	s.respond(incoming.ID, initializeResult{
		ProtocolVersion: negotiate(params.ProtocolVersion),
		ServerInfo:      implementation{Name: s.Name, Version: s.Version},
		Instructions:    s.Instructions,
	})
}

func (s *Server) listing() listResult {
	listed := listResult{Tools: make([]toolListing, 0, len(s.Tools))}
	for _, tool := range s.Tools {
		listed.Tools = append(listed.Tools, toolListing{
			Name:        tool.Name,
			Description: tool.Description,
			InputSchema: tool.InputSchema,
			Annotations: annotations{ReadOnly: tool.ReadOnly},
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

func (s *Server) enqueue(ctx context.Context, incoming message, queue chan<- call) {
	var params callParams
	if err := json.Unmarshal(incoming.Params, &params); err != nil {
		s.fail(incoming.ID, codeInvalidParams, "Invalid params: "+err.Error())
		return
	}
	tool, found := s.find(params.Name)
	if !found {
		s.fail(incoming.ID, codeInvalidParams, "Unknown tool: "+params.Name)
		return
	}
	if len(params.Arguments) == 0 || bytes.Equal(params.Arguments, absentID) {
		params.Arguments = json.RawMessage(noArguments)
	}
	scoped, cancel := context.WithCancel(ctx)
	s.pending.Lock()
	s.cancels[string(incoming.ID)] = cancel
	s.pending.Unlock()
	queue <- call{ctx: scoped, id: incoming.ID, tool: tool, arguments: params.Arguments}
}

func (s *Server) release(queued call) bool {
	s.pending.Lock()
	defer s.pending.Unlock()
	cancelled := queued.ctx.Err() != nil
	s.cancels[string(queued.id)]()
	delete(s.cancels, string(queued.id))
	return cancelled
}

func (s *Server) perform(queued call) {
	result := s.execute(queued)
	if cancelled := s.release(queued); cancelled {
		return
	}
	s.respond(queued.id, result)
}

func toolFailure(text string) callResult {
	return callResult{Content: []content{textContent(text)}, IsError: true}
}

func present(result Result) callResult {
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
	return shown
}

func (s *Server) execute(queued call) (shown callResult) {
	defer func() {
		if crash := recover(); crash != nil {
			fmt.Fprintf(s.Log, "%s stopped unexpectedly: %v\n", queued.tool.Name, crash)
			shown = toolFailure(queued.tool.Name + " stopped unexpectedly; the server is still running.")
		}
	}()
	result, err := queued.tool.Handle(queued.ctx, queued.arguments)
	if err != nil {
		return toolFailure(err.Error())
	}
	return present(result)
}
