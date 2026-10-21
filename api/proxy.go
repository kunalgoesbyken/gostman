package handler

import (
	"encoding/json"
	"log"
	"mime"
	"net/http"
	"net/url"
	"time"

	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/mcpclient"
	"github.com/krockxz/gostman/openapi"
	"github.com/krockxz/gostman/rpc"
)

const (
	maxRequestBytes      = 14 << 20
	maxOpenAPIReplyBytes = 4 << 20
	maxOpenAPIRefs       = 10
	maxOpenAPIBytes      = openapi.DefaultMaxBytes

	actionDescribe = "describe"
	actionInvoke   = "invoke"
)

var Policy = engine.Policy{
	BlockPrivate:      true,
	MaxResponseBytes:  3 << 20,
	MaxTimeout:        30 * time.Second,
	MaxStreamDuration: 60 * time.Second,
}

type prepareResult struct {
	Prepared *engine.Prepared `json:"prepared,omitempty"`
	Error    string           `json:"error,omitempty"`
}

type authorizationPayload struct {
	Config    engine.OAuth2 `json:"config"`
	Variables string        `json:"variables"`
}

type authorizationResult struct {
	Authorization *engine.Authorization `json:"authorization,omitempty"`
	Error         string                `json:"error,omitempty"`
}

type curlPayload struct {
	Command string `json:"command"`
}

type curlResult struct {
	Request *engine.Request `json:"request,omitempty"`
	Error   string          `json:"error,omitempty"`
}

type describeResult struct {
	Schema *rpc.Schema `json:"schema,omitempty"`
	Error  string      `json:"error,omitempty"`
}

type catalogResult struct {
	Catalog *mcpclient.Catalog `json:"catalog,omitempty"`
	Error   string             `json:"error,omitempty"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !isSameOriginJSON(r) {
		http.Error(w, "cross-site requests are not allowed", http.StatusForbidden)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)

	query := r.URL.Query()
	switch {
	case query.Has("sse"):
		streamEvents(w, r)
	case query.Get("grpc") == actionDescribe:
		writeJSON(w, describeGrpc(r))
	case query.Get("grpc") == actionInvoke:
		writeJSON(w, invokeGrpc(r))
	case query.Get("mcp") == actionDescribe:
		writeJSON(w, describeMcp(r))
	case query.Get("mcp") == actionInvoke:
		writeJSON(w, invokeMcp(r))
	case query.Has("openapi"):
		writeJSON(w, readOpenAPI(r))
	case query.Has("curl"):
		writeJSON(w, parseCurl(r))
	case query.Has("prepare"):
		writeJSON(w, prepare(r))
	case query.Get("oauth") == "start":
		writeJSON(w, startAuthorization(r))
	case query.Get("oauth") == "token":
		writeJSON(w, fetchToken(r))
	default:
		writeJSON(w, send(r))
	}
}

func isSameOriginJSON(r *http.Request) bool {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return false
	}
	if site := r.Header.Get("Sec-Fetch-Site"); site != "" && site != "same-origin" && site != "none" {
		return false
	}
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	parsed, err := url.Parse(origin)
	return err == nil && parsed.Host == publicHost(r)
}

func publicHost(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-Host"); forwarded != "" {
		return forwarded
	}
	return r.Host
}

func send(r *http.Request) engine.Response {
	var request engine.Request
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return engine.Failure(engine.ErrorConfig, "the request could not be read: "+err.Error())
	}
	return engine.Send(r.Context(), request, Policy)
}

func streamEvents(w http.ResponseWriter, r *http.Request) {
	var request engine.Request
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, engine.Failure(engine.ErrorConfig, "the request could not be read: "+err.Error()))
		return
	}
	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("X-Accel-Buffering", "no")

	encoder := json.NewEncoder(w)
	controller := http.NewResponseController(w)
	write := func(batch []engine.StreamMessage) {
		for _, message := range batch {
			if err := encoder.Encode(message); err != nil {
				return
			}
		}
		controller.Flush()
	}
	response := engine.Stream(r.Context(), request, Policy, write)
	write([]engine.StreamMessage{{Kind: engine.StreamResponse, Response: &response}})
}

func prepare(r *http.Request) prepareResult {
	var request engine.Request
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return prepareResult{Error: err.Error()}
	}
	prepared, err := engine.Prepare(request)
	if err != nil {
		return prepareResult{Error: err.Error()}
	}
	return prepareResult{Prepared: &prepared}
}

func parseCurl(r *http.Request) curlResult {
	var payload curlPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return curlResult{Error: err.Error()}
	}
	request, err := engine.ParseCurl(payload.Command)
	if err != nil {
		return curlResult{Error: err.Error()}
	}
	return curlResult{Request: &request}
}

func readOpenAPI(r *http.Request) openapi.Reply {
	var query openapi.Query
	if err := json.NewDecoder(r.Body).Decode(&query); err != nil {
		return openapi.Reply{Error: err.Error()}
	}
	query.Source.Path = ""
	reply := openapi.Handle(r.Context(), query, openapi.Options{Policy: Policy, MaxBytes: maxOpenAPIBytes, MaxRefs: maxOpenAPIRefs})
	if encoded, err := json.Marshal(reply); err == nil && len(encoded) > maxOpenAPIReplyBytes {
		return openapi.Reply{Error: "the answer is too large for the web app, so it is read in smaller parts"}
	}
	return reply
}

func startAuthorization(r *http.Request) authorizationResult {
	var payload authorizationPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return authorizationResult{Error: err.Error()}
	}
	started, err := engine.StartAuthorization(payload.Config, payload.Variables)
	if err != nil {
		return authorizationResult{Error: err.Error()}
	}
	return authorizationResult{Authorization: &started}
}

func fetchToken(r *http.Request) engine.Token {
	var exchange engine.TokenExchange
	if err := json.NewDecoder(r.Body).Decode(&exchange); err != nil {
		return engine.Token{Error: "the token request could not be read: " + err.Error()}
	}
	return engine.FetchToken(r.Context(), exchange, Policy)
}

func describeGrpc(r *http.Request) describeResult {
	var target rpc.Target
	if err := json.NewDecoder(r.Body).Decode(&target); err != nil {
		return describeResult{Error: err.Error()}
	}
	schema, err := rpc.Describe(r.Context(), target, Policy)
	if err != nil {
		return describeResult{Error: err.Error()}
	}
	return describeResult{Schema: &schema}
}

func invokeGrpc(r *http.Request) engine.Response {
	var call rpc.Call
	if err := json.NewDecoder(r.Body).Decode(&call); err != nil {
		return engine.Failure(engine.ErrorConfig, "the request could not be read: "+err.Error())
	}
	return rpc.Invoke(r.Context(), call, Policy)
}

func describeMcp(r *http.Request) catalogResult {
	var target mcpclient.Target
	if err := json.NewDecoder(r.Body).Decode(&target); err != nil {
		return catalogResult{Error: err.Error()}
	}
	catalog, err := mcpclient.Describe(r.Context(), target, Policy)
	if err != nil {
		return catalogResult{Error: err.Error()}
	}
	return catalogResult{Catalog: &catalog}
}

func invokeMcp(r *http.Request) engine.Response {
	var call mcpclient.Call
	if err := json.NewDecoder(r.Body).Decode(&call); err != nil {
		return engine.Failure(engine.ErrorConfig, "the request could not be read: "+err.Error())
	}
	return mcpclient.Invoke(r.Context(), call, Policy)
}

func writeJSON(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("proxy: failed to write response: %v", err)
	}
}
