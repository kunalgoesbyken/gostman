package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/krockxz/gostman/engine"
)

const maxRequestBytes = 14 << 20

var Policy = engine.Policy{
	BlockPrivate:     true,
	MaxResponseBytes: 3 << 20,
	MaxTimeout:       30 * time.Second,
}

type prepareResult struct {
	Prepared *engine.Prepared `json:"prepared,omitempty"`
	Error    string           `json:"error,omitempty"`
}

type curlPayload struct {
	Command string `json:"command"`
}

type curlResult struct {
	Request *engine.Request `json:"request,omitempty"`
	Error   string          `json:"error,omitempty"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)

	query := r.URL.Query()
	switch {
	case query.Has("curl"):
		writeJSON(w, parseCurl(r))
	case query.Has("prepare"):
		writeJSON(w, prepare(r))
	default:
		writeJSON(w, send(r))
	}
}

func send(r *http.Request) engine.Response {
	var request engine.Request
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return engine.Failure(engine.ErrorConfig, "the request could not be read: "+err.Error())
	}
	return engine.Send(r.Context(), request, Policy)
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

func writeJSON(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("proxy: failed to write response: %v", err)
	}
}
