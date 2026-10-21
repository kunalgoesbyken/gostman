package mock

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/krockxz/gostman/loopback"
)

const (
	maxRequestBody    = 10 << 20
	readHeaderTimeout = 10 * time.Second
	exchangeTimeout   = 30 * time.Second
	responseTimeout   = exchangeTimeout + 2*highestDelayMs*time.Millisecond
	idleTimeout       = 60 * time.Second
	stopGrace         = 2 * time.Second
)

type Server struct {
	listener  net.Listener
	server    *http.Server
	routes    atomic.Pointer[table]
	onRequest func(Entry)
	cancel    context.CancelFunc
	journal   journal
	random    *chance
}

type outcome struct {
	body    []byte
	route   string
	rule    string
	fault   string
	dropped bool
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Unwrap() http.ResponseWriter {
	return r.ResponseWriter
}

func Start(sources []Source, variables string, config Config, onRequest func(Entry)) (*Server, error) {
	if err := config.Settings.validate(); err != nil {
		return nil, err
	}
	planned, err := buildTable(sources, variables, config)
	if err != nil {
		return nil, err
	}
	listener, err := loopback.Listen(config.Settings.Port)
	if err != nil {
		return nil, err
	}

	lifetime, cancel := context.WithCancel(context.Background())
	started := &Server{
		listener:  listener,
		onRequest: onRequest,
		cancel:    cancel,
		random:    newChance(uint64(time.Now().UnixNano()), uint64(config.Settings.Port)),
	}
	started.routes.Store(planned)
	started.server = &http.Server{
		Handler:           started,
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       exchangeTimeout,
		WriteTimeout:      responseTimeout,
		IdleTimeout:       idleTimeout,
		BaseContext:       func(net.Listener) context.Context { return lifetime },
	}
	go started.server.Serve(listener)
	return started, nil
}

func (s *Server) Address() string {
	return "http://" + s.listener.Addr().String()
}

func (s *Server) Routes() []Route {
	return s.routes.Load().routes
}

func (s *Server) Log() []Entry {
	return s.journal.snapshot()
}

func (s *Server) ClearLog() {
	s.journal.clear()
}

func (s *Server) Update(sources []Source, variables string, config Config) ([]Route, error) {
	planned, err := buildTable(sources, variables, config)
	if err != nil {
		return nil, err
	}
	s.routes.Store(planned)
	return planned.routes, nil
}

func (s *Server) Stop() error {
	s.cancel()
	deadline, release := context.WithTimeout(context.Background(), stopGrace)
	defer release()
	if err := s.server.Shutdown(deadline); err != nil {
		return s.server.Close()
	}
	return nil
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	started := time.Now()
	recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
	call := &outcome{}
	s.respond(recorder, r, call)
	s.record(started, r, recorder.status, call)
}

func (s *Server) record(started time.Time, r *http.Request, status int, call *outcome) {
	if call.dropped {
		status = 0
	}
	entry := s.journal.add(Entry{
		Time:       started,
		Method:     r.Method,
		Path:       maskedTarget(r.URL),
		Headers:    maskedHeaders(r.Header),
		Body:       loggedBody(call.body),
		BodyBytes:  len(call.body),
		Route:      call.route,
		Rule:       call.rule,
		Fault:      call.fault,
		Status:     status,
		DurationMs: time.Since(started).Milliseconds(),
	})
	if s.onRequest != nil {
		s.onRequest(entry)
	}
}

func (s *Server) respond(w http.ResponseWriter, r *http.Request, call *outcome) {
	current := s.routes.Load()
	if !loopback.IsHost(r.Host) {
		s.send(w, r, current, problem(http.StatusForbidden, "The mock server only answers requests addressed to localhost."), 0)
		return
	}
	if current.settings.CORS && isPreflight(r) {
		s.send(w, r, current, preflightAnswer(r), 0)
		return
	}
	body, err := readBody(w, r)
	if err != nil {
		s.send(w, r, current, problem(http.StatusRequestEntityTooLarge, fmt.Sprintf("The request body is larger than %d MB.", maxRequestBody>>20)), 0)
		return
	}
	call.body = body
	request := newExchange(r, body)
	chosen, found := current.resolve(request)
	if !found {
		s.send(w, r, current, problem(http.StatusNotFound, fmt.Sprintf("No mock route matches %s %s.", r.Method, r.URL.Path)), 0)
		return
	}
	call.route, call.rule = chosen.route, chosen.rule
	request.params = chosen.params
	behavior := chosen.behavior
	if behavior.isZero() {
		behavior = current.settings.Behavior
	}
	if !wait(r.Context(), behavior.delay(s.random)) {
		s.send(w, r, current, problem(http.StatusServiceUnavailable, "The mock server stopped before it answered."), 0)
		return
	}
	if s.random.roll(behavior.Fault.Percent) {
		call.fault = behavior.Fault.kind()
		call.dropped = s.inject(w, r, current, behavior.Fault)
		return
	}
	reply, err := chosen.answer.render(request, current.variables)
	if err != nil {
		s.send(w, r, current, problem(http.StatusInternalServerError, err.Error()), 0)
		return
	}
	s.send(w, r, current, reply, behavior.slowBody())
}

func (s *Server) inject(w http.ResponseWriter, r *http.Request, current *table, fault Fault) bool {
	if fault.kind() != FaultStatus && drop(w, fault.kind() == FaultReset) {
		return true
	}
	s.send(w, r, current, problem(fault.status(), "The mock server injected this failure."), 0)
	return false
}

func drop(w http.ResponseWriter, reset bool) bool {
	connection, _, err := http.NewResponseController(w).Hijack()
	if err != nil {
		return false
	}
	if tcp, ok := connection.(*net.TCPConn); ok && reset {
		tcp.SetLinger(0)
	}
	connection.Close()
	return true
}

func (s *Server) send(w http.ResponseWriter, r *http.Request, current *table, reply answer, slow time.Duration) {
	header := w.Header()
	for _, stored := range reply.headers {
		header.Add(stored.Key, stored.Value)
	}
	header.Set("X-Content-Type-Options", "nosniff")
	header.Set("Content-Security-Policy", "sandbox")
	if current.settings.CORS {
		allowOrigin(header, r)
	}
	if !allowsBody(reply.status) {
		w.WriteHeader(reply.status)
		return
	}
	header.Set("Content-Length", strconv.Itoa(len(reply.body)))
	w.WriteHeader(reply.status)
	if r.Method != http.MethodHead {
		writeBody(r.Context(), w, reply.body, slow)
	}
}

func writeBody(ctx context.Context, w http.ResponseWriter, body []byte, slow time.Duration) {
	if slow <= 0 || len(body) == 0 {
		w.Write(body)
		return
	}
	size := (len(body) + slowChunks - 1) / slowChunks
	chunks := (len(body) + size - 1) / size
	pause := slow / time.Duration(max(1, chunks-1))
	flusher := http.NewResponseController(w)
	for start := 0; start < len(body); start += size {
		w.Write(body[start:min(start+size, len(body))])
		flusher.Flush()
		if start+size < len(body) && !wait(ctx, pause) {
			return
		}
	}
}

func allowsBody(status int) bool {
	return status != http.StatusNoContent && status != http.StatusNotModified
}

func readBody(w http.ResponseWriter, r *http.Request) ([]byte, error) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxRequestBody))
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		return nil, err
	}
	return body, nil
}

func wait(ctx context.Context, delay time.Duration) bool {
	if delay <= 0 {
		return true
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-timer.C:
		return true
	case <-ctx.Done():
		return false
	}
}
