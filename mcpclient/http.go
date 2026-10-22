package mcpclient

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/mcp"
)

const (
	headerAccept      = "Accept"
	headerContentType = "Content-Type"
	headerSession     = "Mcp-Session-Id"
	headerVersion     = "Mcp-Protocol-Version"

	typeJSON      = "application/json"
	typeStream    = "text/event-stream"
	acceptedTypes = typeJSON + ", " + typeStream
)

type httpLink struct {
	client  *http.Client
	address string
	headers []engine.HeaderEntry
	id      string
	version string
	limit   int64
}

func newClient(options engine.Options, policy engine.Policy) *http.Client {
	client := &http.Client{Transport: policy.Transport(options.InsecureTLS)}
	if options.NoFollowRedirects {
		client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	}
	return client
}

func setDefault(header http.Header, name, value string) {
	if value != "" && header.Get(name) == "" {
		header.Set(name, value)
	}
}

func (l *httpLink) header() http.Header {
	header := http.Header{}
	for _, entry := range l.headers {
		header.Add(entry.Key, entry.Value)
	}
	setDefault(header, headerAccept, acceptedTypes)
	setDefault(header, headerContentType, typeJSON)
	setDefault(header, headerSession, l.id)
	setDefault(header, headerVersion, l.version)
	return header
}

func (l *httpLink) exchange(ctx context.Context, method string, body io.Reader) (*http.Response, error) {
	outgoing, err := http.NewRequestWithContext(ctx, method, l.address, body)
	if err != nil {
		return nil, configError("%v", err)
	}
	outgoing.Header = l.header()
	return l.client.Do(outgoing)
}

func (l *httpLink) post(ctx context.Context, payload any) (*http.Response, error) {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return nil, configError("the message cannot be encoded: %v", err)
	}
	return l.exchange(ctx, http.MethodPost, bytes.NewReader(encoded))
}

func isAccepted(incoming *http.Response) bool {
	return incoming.StatusCode >= http.StatusOK && incoming.StatusCode < http.StatusMultipleChoices
}

func (l *httpLink) bounded(incoming *http.Response) *io.LimitedReader {
	return &io.LimitedReader{R: incoming.Body, N: l.limit + 1}
}

func (l *httpLink) tooLarge() error {
	return answerTooLarge(l.limit)
}

func answerTooLarge(limit int64) error {
	return protocolError("the server's answer is larger than the limit of %d bytes", limit)
}

func describeAnswer(incoming *http.Response) answer {
	return answer{status: incoming.Status, code: incoming.StatusCode, header: incoming.Header}
}

func (l *httpLink) rejected(incoming *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(incoming.Body, l.limit))
	return &rejection{answer: describeAnswer(incoming), body: strings.ToValidUTF8(string(body), "�")}
}

func (l *httpLink) deliver(ctx context.Context, payload any) error {
	incoming, err := l.post(ctx, payload)
	if err != nil {
		return err
	}
	defer incoming.Body.Close()
	if !isAccepted(incoming) {
		return l.rejected(incoming)
	}
	return nil
}

func (l *httpLink) roundTrip(ctx context.Context, id json.RawMessage, message mcp.Message, limit int64) (answer, envelope, error) {
	l.limit = limit
	incoming, err := l.post(ctx, message)
	if err != nil {
		return answer{}, envelope{}, err
	}
	defer incoming.Body.Close()
	if !isAccepted(incoming) {
		return answer{}, envelope{}, l.rejected(incoming)
	}
	reply, err := l.reply(ctx, incoming, id)
	if err != nil {
		return answer{}, envelope{}, err
	}
	return describeAnswer(incoming), reply, nil
}

func (l *httpLink) established(sessionID, version string) {
	l.id, l.version = sessionID, version
}

func (l *httpLink) close() {
	if l.id == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), farewellTimeout)
	defer cancel()
	if incoming, err := l.exchange(ctx, http.MethodDelete, nil); err == nil {
		incoming.Body.Close()
	}
}
