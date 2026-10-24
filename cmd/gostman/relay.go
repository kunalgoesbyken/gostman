package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"time"

	handler "github.com/kunalgoesbyken/gostman/api"
	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/loopback"
	"github.com/kunalgoesbyken/gostman/runner"
)

const (
	relayPath            = "/api/proxy"
	headerTimeout        = 10 * time.Second
	shutdownTimeout      = 5 * time.Second
	relayPreflightMaxAge = "600"
	crossSiteFetch       = "cross-site"
	sameSiteFetch        = "same-site"
	refusedRelayHost     = "the relay only answers requests addressed to 127.0.0.1 or localhost"
	refusedRelayOrigin   = "this page is not allowed to use the relay; start it with --origin to allow another web address"
)

var webAppOrigins = []string{"https://gostman.com", "https://www.gostman.com"}

type relayGuard struct {
	origins map[string]bool
	next    http.Handler
	refused *refusedOrigins
}

type refusedOrigins struct {
	mu   sync.Mutex
	seen map[string]bool
	log  io.Writer
}

func (r *refusedOrigins) note(raw string) {
	origin, err := loopback.ParseOrigin(raw)
	if err != nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.seen[origin.Canonical] {
		return
	}
	r.seen[origin.Canonical] = true
	fmt.Fprintf(r.log, "Refused the page at %s. If it is a copy of the Gostman web app that you run, restart with --origin %s.\n", origin.Canonical, origin.Canonical)
}

func newRelayGuard(extra []string, next http.Handler, log io.Writer) (relayGuard, error) {
	guard := relayGuard{origins: map[string]bool{}, next: next, refused: &refusedOrigins{seen: map[string]bool{}, log: log}}
	for _, raw := range append(append([]string{}, webAppOrigins...), extra...) {
		origin, err := loopback.ParseOrigin(raw)
		if err != nil {
			return guard, fmt.Errorf("--origin %q is not an origin: %w", raw, err)
		}
		guard.origins[origin.Canonical] = true
	}
	return guard, nil
}

func (g relayGuard) allows(raw string) bool {
	origin, err := loopback.ParseOrigin(raw)
	return err == nil && (origin.IsLocal || g.origins[origin.Canonical])
}

func isBrowserCrossSite(r *http.Request) bool {
	site := r.Header.Get("Sec-Fetch-Site")
	return site == crossSiteFetch || site == sameSiteFetch
}

func allowRelayOrigin(w http.ResponseWriter, r *http.Request, origin string) {
	header := w.Header()
	header.Add("Vary", "Origin")
	header.Set("Access-Control-Allow-Origin", origin)
	if r.Method != http.MethodOptions {
		return
	}
	header.Set("Access-Control-Allow-Methods", http.MethodPost)
	header.Set("Access-Control-Allow-Headers", "Content-Type")
	header.Set("Access-Control-Max-Age", relayPreflightMaxAge)
	if r.Header.Get("Access-Control-Request-Private-Network") == "true" {
		header.Set("Access-Control-Allow-Private-Network", "true")
	}
}

func (g relayGuard) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	switch {
	case !loopback.IsHost(r.Host):
		http.Error(w, refusedRelayHost, http.StatusForbidden)
		return
	case r.URL.Path != relayPath:
		http.NotFound(w, r)
		return
	case origin == "" && isBrowserCrossSite(r):
		http.Error(w, refusedRelayOrigin, http.StatusForbidden)
		return
	case origin != "" && !g.allows(origin):
		g.refused.note(origin)
		http.Error(w, refusedRelayOrigin, http.StatusForbidden)
		return
	}
	if origin != "" {
		allowRelayOrigin(w, r, origin)
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	r.Header.Del("Origin")
	r.Header.Del("Sec-Fetch-Site")
	g.next.ServeHTTP(w, r)
}

func serveRelay(port int, origins []string, network *engine.Network, stdout, stderr io.Writer) error {
	if err := loopback.CheckPort(port); err != nil {
		return err
	}
	handler.Policy = engine.Policy{Network: network}
	guard, err := newRelayGuard(origins, http.HandlerFunc(handler.Handler), stderr)
	if err != nil {
		return err
	}
	listener, err := loopback.Listen(port)
	if err != nil {
		return err
	}
	fmt.Fprintf(stdout, "Relay for the Gostman web app at http://%s\nIn the web app, open Preferences, Privacy, choose \"Local relay on this computer\" and enter this address. Press Ctrl+C to stop.\n", listener.Addr())
	return serveUntilInterrupted(listener, guard)
}

func serveUntilInterrupted(listener net.Listener, handler http.Handler) error {
	server := &http.Server{Handler: handler, ReadHeaderTimeout: headerTimeout}
	failed := make(chan error, 1)
	go func() { failed <- server.Serve(listener) }()

	interrupted, release := signal.NotifyContext(context.Background(), os.Interrupt)
	defer release()
	select {
	case err := <-failed:
		return err
	case <-interrupted.Done():
	}
	deadline, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := server.Shutdown(deadline); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return server.Close()
	}
	return nil
}

func relayCommand(arguments []string, stdout, stderr *os.File) int {
	flags := flag.NewFlagSet("relay", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	port := flags.Int("port", 0, "")
	var origins originFlags
	flags.Var(&origins, "origin", "")
	settings := networkFlags(flags)
	settings.advice = relayAdvice
	positional, err := parseInterspersed(flags, arguments)
	if err == nil {
		err = settings.check()
	}
	switch {
	case err != nil:
		return misuse(stderr, err.Error())
	case len(positional) > 0:
		return misuse(stderr, "relay takes flags only")
	}
	network, err := settings.network(runner.Collection{})
	if err != nil {
		return complain(stderr, err)
	}
	if err := serveRelay(*port, origins, network, stdout, stderr); err != nil {
		return complain(stderr, err)
	}
	return exitPassed
}
