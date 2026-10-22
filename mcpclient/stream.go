package mcpclient

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/kunalgoesbyken/gostman/mcp"
)

var (
	dataField     = []byte("data:")
	fieldPadding  = []byte(" ")
	lineSeparator = []byte("\n")
)

func (l *httpLink) reply(ctx context.Context, incoming *http.Response, id json.RawMessage) (envelope, error) {
	body := l.bounded(incoming)
	switch mediaType(incoming.Header) {
	case typeJSON:
		return l.readReply(body, id)
	case typeStream:
		return l.awaitReply(ctx, body, id)
	default:
		return envelope{}, protocolError(
			"%s did not answer as an MCP server: it sent %q instead of JSON or an event stream",
			l.address, incoming.Header.Get(headerContentType),
		)
	}
}

func (l *httpLink) readReply(body *io.LimitedReader, id json.RawMessage) (envelope, error) {
	content, err := io.ReadAll(body)
	if err != nil {
		return envelope{}, err
	}
	if body.N <= 0 {
		return envelope{}, l.tooLarge()
	}
	var reply envelope
	if err := json.Unmarshal(content, &reply); err != nil {
		return envelope{}, protocolError("%s did not answer with a JSON-RPC message: %v", l.address, err)
	}
	if !hasID(reply.ID) && reply.Error == nil {
		return envelope{}, protocolError("%s did not answer with a JSON-RPC reply", l.address)
	}
	if !reply.answers(id) {
		return envelope{}, protocolError("the server answered request %s instead of request %s", reply.ID, id)
	}
	return reply, nil
}

func nextEvent(events *bufio.Reader) ([]byte, error) {
	var data [][]byte
	for {
		line, err := events.ReadBytes('\n')
		if err != nil {
			return nil, err
		}
		line = bytes.TrimRight(line, "\r\n")
		if len(line) == 0 && len(data) > 0 {
			return bytes.Join(data, lineSeparator), nil
		}
		if value, found := bytes.CutPrefix(line, dataField); found {
			data = append(data, bytes.TrimPrefix(value, fieldPadding))
		}
	}
}

func (l *httpLink) awaitReply(ctx context.Context, body *io.LimitedReader, id json.RawMessage) (envelope, error) {
	events := bufio.NewReader(body)
	for {
		data, err := nextEvent(events)
		if err != nil {
			return envelope{}, l.interrupted(body, err)
		}
		var incoming envelope
		if json.Unmarshal(data, &incoming) != nil {
			continue
		}
		if incoming.answers(id) {
			return incoming, nil
		}
		if !incoming.isRequest() {
			continue
		}
		if err := l.deliver(ctx, answerTo(incoming)); err != nil {
			return envelope{}, err
		}
	}
}

func (l *httpLink) interrupted(body *io.LimitedReader, err error) error {
	if body.N <= 0 {
		return l.tooLarge()
	}
	if errors.Is(err, io.EOF) {
		return protocolError("the event stream ended before the server answered")
	}
	return err
}

func answerTo(request envelope) mcp.Reply {
	reply := mcp.Reply{Version: mcp.JSONRPCVersion, ID: request.ID}
	if request.Method == mcp.MethodPing {
		reply.Result = mcp.Empty{}
		return reply
	}
	reply.Error = &mcp.Failure{Code: mcp.CodeMethodNotFound, Message: "Method not found: " + request.Method}
	return reply
}
