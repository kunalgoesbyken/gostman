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
	"time"

	"github.com/krockxz/gostman/loopback"
)

const (
	readHeaderTimeout = 10 * time.Second
	stallTimeout      = 30 * time.Second
	idleTimeout       = 60 * time.Second
	stopGrace         = 2 * time.Second

	refusedHost     = "Gostman capture only answers requests addressed to localhost."
	cancelledReason = "the exchange was cancelled before the upstream answered"
)

var upstreamSchemes = map[string]bool{"http": true, "https": true}

type Server struct {
	listener   net.Listener
	server     *http.Server
	proxy      *httputil.ReverseProxy
	upstream   *url.URL
	onExchange func(Exchange)
	cancel     context.CancelFunc
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

func Start(settings Settings, transport http.RoundTripper, onExchange func(Exchange)) (*Server, error) {
	upstream, err := settings.target()
	if err != nil {
		return nil, err
	}
	listener, err := loopback.Listen(settings.Port)
	if err != nil {
		return nil, err
	}

	lifetime, cancel := context.WithCancel(context.Background())
	silent := log.New(io.Discard, "", 0)
	started := &Server{listener: listener, upstream: upstream, onExchange: onExchange, cancel: cancel}
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

const refusedOrigin = "The capture only forwards requests from pages served on localhost."

func isLocalOrigin(origin string) bool {
	if origin == "" {
		return true
	}
	parsed, err := url.Parse(origin)
	return err == nil && parsed.Host != "" && loopback.IsHost(parsed.Host)
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !loopback.IsHost(r.Host) {
		http.Error(w, refusedHost, http.StatusForbidden)
		return
	}
	if !isLocalOrigin(r.Header.Get("Origin")) {
		http.Error(w, refusedOrigin, http.StatusForbidden)
		return
	}
	control := http.NewResponseController(w)
	take := newRecording(r, s.onExchange)
	defer take.finish()
	defer control.SetWriteDeadline(time.Time{})
	r.Body = observedBody{r.Body, &take.sent}
	s.proxy.ServeHTTP(steadyWriter{w, control}, r.WithContext(take.attach(r.Context())))
}

func (s *Server) forward(call *httputil.ProxyRequest) {
	call.Out.URL.RawQuery = call.In.URL.RawQuery
	call.SetURL(s.upstream)
	recordingOf(call.In.Context()).exchange.URL = call.Out.URL.String()
}

func (s *Server) observe(response *http.Response) error {
	take := recordingOf(response.Request.Context())
	take.answered(response)
	s.localize(response.Header, take.host)
	return nil
}

func (s *Server) refuse(w http.ResponseWriter, r *http.Request, err error) {
	take := recordingOf(r.Context())
	if errors.Is(r.Context().Err(), context.Canceled) {
		take.failed(0, cancelledReason)
		return
	}
	take.failed(http.StatusBadGateway, err.Error())
	http.Error(w, fmt.Sprintf("Gostman capture could not reach %s: %v", s.upstream.Host, err), http.StatusBadGateway)
}
