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
	highestDelayMs    = 60_000
	maxRequestBody    = 10 << 20
	readHeaderTimeout = 10 * time.Second
	exchangeTimeout   = 30 * time.Second
	idleTimeout       = 60 * time.Second
	stopGrace         = 2 * time.Second
)

type Server struct {
	listener  net.Listener
	server    *http.Server
	routes    atomic.Pointer[table]
	settings  Settings
	onRequest func(Entry)
	cancel    context.CancelFunc
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func Start(sources []Source, variables string, settings Settings, onRequest func(Entry)) (*Server, error) {
	if err := settings.validate(); err != nil {
		return nil, err
	}
	planned, err := buildTable(sources, variables)
	if err != nil {
		return nil, err
	}
	listener, err := loopback.Listen(settings.Port)
	if err != nil {
		return nil, err
	}

	lifetime, cancel := context.WithCancel(context.Background())
	started := &Server{listener: listener, settings: settings, onRequest: onRequest, cancel: cancel}
	started.routes.Store(planned)
	started.server = &http.Server{
		Handler:           started,
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       exchangeTimeout,
		WriteTimeout:      exchangeTimeout + settings.delay(),
		IdleTimeout:       idleTimeout,
		BaseContext:       func(net.Listener) context.Context { return lifetime },
	}
	go started.server.Serve(listener)
	return started, nil
}

func (s Settings) validate() error {
	if err := loopback.CheckPort(s.Port); err != nil {
		return err
	}
	if s.DelayMs < 0 || s.DelayMs > highestDelayMs {
		return fmt.Errorf("the delay must be between 0 and %d ms", highestDelayMs)
	}
	return nil
}

func (s Settings) delay() time.Duration {
	return time.Duration(s.DelayMs) * time.Millisecond
}

func (s *Server) Address() string {
	return "http://" + s.listener.Addr().String()
}

func (s *Server) Routes() []Route {
	return s.routes.Load().routes
}

func (s *Server) Update(sources []Source, variables string) ([]Route, error) {
	planned, err := buildTable(sources, variables)
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
	routeName := s.respond(recorder, r)
	if s.onRequest == nil {
		return
	}
	s.onRequest(Entry{
		Time:       started,
		Method:     r.Method,
		Path:       r.URL.RequestURI(),
		Route:      routeName,
		Status:     recorder.status,
		DurationMs: time.Since(started).Milliseconds(),
	})
}

func (s *Server) respond(w http.ResponseWriter, r *http.Request) string {
	if !loopback.IsHost(r.Host) {
		s.send(w, r, problem(http.StatusForbidden, "The mock server only answers requests addressed to localhost."))
		return ""
	}
	if s.settings.CORS && isPreflight(r) {
		s.send(w, r, preflightAnswer(r))
		return ""
	}
	if err := drain(w, r); err != nil {
		s.send(w, r, problem(http.StatusRequestEntityTooLarge, fmt.Sprintf("The request body is larger than %d MB.", maxRequestBody>>20)))
		return ""
	}
	matched, found := s.routes.Load().find(r.Method, requestParts(r.URL))
	if !found {
		s.send(w, r, problem(http.StatusNotFound, fmt.Sprintf("No mock route matches %s %s.", r.Method, r.URL.Path)))
		return ""
	}
	if !wait(r.Context(), s.settings.delay()) {
		s.send(w, r, problem(http.StatusServiceUnavailable, "The mock server stopped before it answered."))
		return matched.name
	}
	s.send(w, r, matched.answer)
	return matched.name
}

func (s *Server) send(w http.ResponseWriter, r *http.Request, reply answer) {
	header := w.Header()
	for _, stored := range reply.headers {
		header.Add(stored.Key, stored.Value)
	}
	header.Set("X-Content-Type-Options", "nosniff")
	header.Set("Content-Security-Policy", "sandbox")
	if s.settings.CORS {
		allowOrigin(header, r)
	}
	if !allowsBody(reply.status) {
		w.WriteHeader(reply.status)
		return
	}
	header.Set("Content-Length", strconv.Itoa(len(reply.body)))
	w.WriteHeader(reply.status)
	if r.Method != http.MethodHead {
		w.Write(reply.body)
	}
}

func allowsBody(status int) bool {
	return status != http.StatusNoContent && status != http.StatusNotModified
}

func drain(w http.ResponseWriter, r *http.Request) error {
	_, err := io.Copy(io.Discard, http.MaxBytesReader(w, r.Body, maxRequestBody))
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		return err
	}
	return nil
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
