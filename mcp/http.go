package mcp

import (
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"

	"github.com/kunalgoesbyken/gostman/loopback"
)

const (
	Endpoint        = "/mcp"
	maxMessageBytes = 4 << 20
	bearerPrefix    = "Bearer "
	eventStream     = "text/event-stream"
	jsonContent     = "application/json"
	queuedMessages  = 16
	encodedPrefix   = "=?base64?"
	encodedSuffix   = "?="
	versionHeader   = "MCP-Protocol-Version"
	methodHeader    = "Mcp-Method"
	nameHeader      = "Mcp-Name"
)

var namedMethods = []string{MethodCallTool, "resources/read", "prompts/get"}

type Gateway struct {
	Server *Server
	Token  string
}

func (g *Gateway) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if status := g.refusal(r); status != 0 {
		if status == http.StatusUnauthorized {
			w.Header().Set("WWW-Authenticate", "Bearer")
		}
		http.Error(w, http.StatusText(status), status)
		return
	}
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	g.post(w, r)
}

func isLoopbackOrigin(raw string) bool {
	origin, err := loopback.ParseOrigin(raw)
	return err == nil && origin.IsLocal
}

func (g *Gateway) authorized(header string) bool {
	presented, found := strings.CutPrefix(header, bearerPrefix)
	return found && subtle.ConstantTimeCompare([]byte(presented), []byte(g.Token)) == 1
}

func (g *Gateway) refusal(r *http.Request) int {
	origin := r.Header.Get("Origin")
	switch {
	case r.URL.Path != Endpoint:
		return http.StatusNotFound
	case !loopback.IsHost(r.Host):
		return http.StatusForbidden
	case origin != "" && !isLoopbackOrigin(origin):
		return http.StatusForbidden
	case !g.authorized(r.Header.Get("Authorization")):
		return http.StatusUnauthorized
	}
	return 0
}

func (g *Gateway) post(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, maxMessageBytes+1))
	if err != nil || len(body) > maxMessageBytes {
		http.Error(w, http.StatusText(http.StatusRequestEntityTooLarge), http.StatusRequestEntityTooLarge)
		return
	}
	incoming, code, _ := parse(body)
	stateless := code == 0 && !incoming.isNotification()
	if stateless {
		var refusal *Failure
		stateless, refusal = classify(incoming)
		if refusal == nil && stateless {
			refusal = headerMismatch(r.Header, incoming)
		}
		if refusal != nil {
			writeJSON(w, http.StatusBadRequest, Reply{Version: JSONRPCVersion, ID: incoming.ID, Error: refusal})
			return
		}
	}
	messages := make(chan any, queuedMessages)
	done := g.Server.handle(r.Context(), body, func(message any) {
		select {
		case messages <- message:
		case <-r.Context().Done():
		}
	})
	if strings.Contains(r.Header.Get("Accept"), eventStream) {
		g.stream(w, messages, done, stateless)
		return
	}
	g.reply(w, messages, done, stateless)
}

func decodedHeader(value string) string {
	inner, encoded := strings.CutPrefix(value, encodedPrefix)
	inner, closed := strings.CutSuffix(inner, encodedSuffix)
	if !encoded || !closed {
		return value
	}
	decoded, err := base64.StdEncoding.DecodeString(inner)
	if err != nil {
		return value
	}
	return string(decoded)
}

func headerMismatch(header http.Header, incoming Message) *Failure {
	version, _, _ := declaredVersion(incoming)
	var named namedParams
	json.Unmarshal(incoming.Params, &named)
	checks := [][3]string{{versionHeader, header.Get(versionHeader), version}, {methodHeader, header.Get(methodHeader), incoming.Method}}
	if slices.Contains(namedMethods, incoming.Method) {
		checks = append(checks, [3]string{nameHeader, decodedHeader(header.Get(nameHeader)), named.Name + named.URI})
	}
	for _, check := range checks {
		if check[1] != check[2] {
			return &Failure{Code: codeHeaderMismatch, Message: fmt.Sprintf("Header mismatch: %s header value %q does not match body value %q", check[0], check[1], check[2])}
		}
	}
	return nil
}

func statusOf(message any, stateless bool) int {
	reply, isReply := message.(Reply)
	if !stateless || !isReply || reply.Error == nil {
		return http.StatusOK
	}
	switch reply.Error.Code {
	case CodeMethodNotFound:
		return http.StatusNotFound
	case codeInvalidParams, codeUnsupportedVersion, codeHeaderMismatch:
		return http.StatusBadRequest
	}
	return http.StatusOK
}

func writeJSON(w http.ResponseWriter, status int, message any) {
	encoded, err := encode(message)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", jsonContent)
	w.WriteHeader(status)
	io.WriteString(w, encoded)
}

func collect(messages <-chan any, done <-chan struct{}, deliver func(any)) {
	for {
		select {
		case message := <-messages:
			deliver(message)
		case <-done:
			for {
				select {
				case message := <-messages:
					deliver(message)
				default:
					return
				}
			}
		}
	}
}

func (g *Gateway) reply(w http.ResponseWriter, messages <-chan any, done <-chan struct{}, stateless bool) {
	var last any
	collect(messages, done, func(message any) {
		if _, isReply := message.(Reply); isReply {
			last = message
		}
	})
	if last == nil {
		w.WriteHeader(http.StatusAccepted)
		return
	}
	writeJSON(w, statusOf(last, stateless), last)
}

func (g *Gateway) stream(w http.ResponseWriter, messages <-chan any, done <-chan struct{}, stateless bool) {
	flusher, _ := w.(http.Flusher)
	started := false
	collect(messages, done, func(message any) {
		if status := statusOf(message, stateless); !started && status != http.StatusOK {
			writeJSON(w, status, message)
			started = true
			return
		}
		encoded, err := encode(message)
		if err != nil {
			fmt.Fprintf(g.Server.Log, "a reply could not be encoded: %s\n", err)
			return
		}
		if !started {
			w.Header().Set("Content-Type", eventStream)
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("X-Accel-Buffering", "no")
			started = true
		}
		fmt.Fprintf(w, "event: message\ndata: %s\n\n", encoded)
		if flusher != nil {
			flusher.Flush()
		}
	})
	if !started {
		w.WriteHeader(http.StatusAccepted)
	}
}
