package capture

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/kunalgoesbyken/gostman/loopback"
	"github.com/kunalgoesbyken/gostman/mock"
)

const (
	readHeaderTimeout = 10 * time.Second
	stallTimeout      = 30 * time.Second
	idleTimeout       = 60 * time.Second
	stopGrace         = 2 * time.Second

	refusedHost     = "Gostman capture only answers requests addressed to localhost."
	cancelledReason = "the exchange was cancelled before the upstream answered"
	droppedReason   = "dropped at a breakpoint"
)

var upstreamSchemes = map[string]bool{"http": true, "https": true}

var errDropped = errors.New(droppedReason)

type Hooks struct {
	Exchange func(Exchange)
	Held     func(Held)
	Settled  func(int64)
}

type Server struct {
	listener     net.Listener
	server       *http.Server
	proxy        *httputil.ReverseProxy
	upstream     *url.URL
	hooks        Hooks
	cancel       context.CancelFunc
	rules        atomic.Pointer[Ruleset]
	root         string
	dice         *mock.Dice
	holds        holds
	breakSeconds atomic.Int32
}

type steadyWriter struct {
	http.ResponseWriter
	control *http.ResponseController
}

func (w steadyWriter) Write(chunk []byte) (int, error) {
	w.control.SetWriteDeadline(time.Now().Add(stallTimeout))
	return w.ResponseWriter.Write(chunk)
}

func (w steadyWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

func parseUpstream(raw string) (*url.URL, error) {
	upstream, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || upstream.Host == "" || !upstreamSchemes[upstream.Scheme] {
		return nil, fmt.Errorf("the upstream must be an http or https URL, got %q", raw)
	}
	return upstream, nil
}

func (s Settings) target() (*url.URL, error) {
	if err := loopback.CheckPort(s.Port); err != nil {
		return nil, err
	}
	upstream, err := parseUpstream(s.Upstream)
	if err != nil {
		return nil, err
	}
	if s.Port != 0 && loopback.IsHost(upstream.Host) && upstream.Port() == strconv.Itoa(s.Port) {
		return nil, fmt.Errorf("the upstream %s is the capture address itself", upstream.Host)
	}
	return upstream, nil
}

func Start(settings Settings, transport http.RoundTripper, hooks Hooks) (*Server, error) {
	upstream, err := settings.target()
	if err != nil {
		return nil, err
	}
	rules, err := Compile(settings.Rules, settings.FilesRoot != "")
	if err != nil {
		return nil, err
	}
	listener, err := loopback.Listen(settings.Port)
	if err != nil {
		return nil, err
	}

	lifetime, cancel := context.WithCancel(context.Background())
	silent := log.New(io.Discard, "", 0)
	started := &Server{
		listener:     listener,
		upstream:     upstream,
		hooks:        hooks,
		cancel:       cancel,
		root:         settings.FilesRoot,
		dice:         mock.NewDice(uint64(time.Now().UnixNano()), uint64(settings.Port)),
	}
	started.rules.Store(rules)
	started.breakSeconds.Store(int32(settings.BreakSeconds))
	started.proxy = &httputil.ReverseProxy{
		Rewrite:        started.forward,
		Transport:      transport,
		ModifyResponse: started.observe,
		ErrorHandler:   started.refuse,
		ErrorLog:       silent,
	}
	started.server = &http.Server{
		Handler:           started,
		ReadHeaderTimeout: readHeaderTimeout,
		IdleTimeout:       idleTimeout,
		ErrorLog:          silent,
		BaseContext:       func(net.Listener) context.Context { return lifetime },
	}
	go started.server.Serve(listener)
	return started, nil
}

func (s *Server) UpdateRules(rules []Rule, breakSeconds int) error {
	compiled, err := Compile(rules, s.root != "")
	if err != nil {
		return err
	}
	s.rules.Store(compiled)
	s.breakSeconds.Store(int32(breakSeconds))
	return nil
}

func (s *Server) Address() string {
	return "http://" + s.listener.Addr().String()
}

func (s *Server) Upstream() string {
	return s.upstream.String()
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

const crossSite = "cross-site"

const refusedOrigin = "The capture only forwards requests from pages served on localhost."

func isLocalOrigin(origin string) bool {
	if origin == "" {
		return true
	}
	parsed, err := url.Parse(origin)
	return err == nil && parsed.Host != "" && loopback.IsHost(parsed.Host)
}

func (s *Server) describe(r *http.Request) callInfo {
	return callInfo{method: r.Method, host: s.upstream.Host, path: r.URL.Path, query: r.URL.Query(), header: r.Header}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !loopback.IsHost(r.Host) {
		http.Error(w, refusedHost, http.StatusForbidden)
		return
	}
	if !isLocalOrigin(r.Header.Get("Origin")) || r.Header.Get("Sec-Fetch-Site") == crossSite {
		http.Error(w, refusedOrigin, http.StatusForbidden)
		return
	}
	control := http.NewResponseController(w)
	steady := steadyWriter{w, control}
	take := newRecording(r, s.hooks.Exchange)
	defer take.finish()
	defer control.SetWriteDeadline(time.Time{})
	r = r.WithContext(take.attach(r.Context()))
	take.plan = s.rules.Load().plan(s.describe(r), s.dice)
	take.exchange.Rules = take.plan.fired
	if !s.prepare(steady, r, take) {
		return
	}
	take.reseed(r)
	r.Body = observedBody{slowed(r.Context(), r.Body, take.plan.throttle.UploadKBps), &take.sent}
	s.proxy.ServeHTTP(steady, r)
}

func (s *Server) destination(in *http.Request, take *recording) *url.URL {
	if take.override != nil {
		return take.override
	}
	base := s.upstream
	if take.target != nil {
		base = take.target
	}
	probe := &httputil.ProxyRequest{In: in, Out: in.Clone(in.Context())}
	probe.SetURL(base)
	probe.Out.URL.RawQuery = in.URL.RawQuery
	return probe.Out.URL
}

func (s *Server) forward(call *httputil.ProxyRequest) {
	take := recordingOf(call.In.Context())
	target := s.destination(call.In, take)
	call.Out.URL = target
	call.Out.Host = ""
	take.exchange.URL = target.String()
}

func (s *Server) observe(response *http.Response) error {
	take := recordingOf(response.Request.Context())
	if response.StatusCode != http.StatusSwitchingProtocols {
		if err := s.reshape(response, take); err != nil {
			return err
		}
	}
	take.answered(response)
	s.localize(response.Header, take.host)
	return nil
}

func (s *Server) refuse(w http.ResponseWriter, r *http.Request, err error) {
	take := recordingOf(r.Context())
	if errors.Is(err, errDropped) {
		take.failed(0, droppedReason)
		panic(http.ErrAbortHandler)
	}
	if errors.Is(r.Context().Err(), context.Canceled) {
		take.failed(0, cancelledReason)
		return
	}
	take.failed(http.StatusBadGateway, err.Error())
	http.Error(w, fmt.Sprintf("Gostman capture could not reach %s: %v", s.destinationHost(take), err), http.StatusBadGateway)
}

func (s *Server) destinationHost(take *recording) string {
	if take.override != nil {
		return take.override.Host
	}
	if take.target != nil {
		return take.target.Host
	}
	return s.upstream.Host
}
