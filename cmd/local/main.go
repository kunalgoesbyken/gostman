// Command local runs the /api/proxy endpoint on a local HTTP server so the web
// frontend (`npm run dev:web`) has something to proxy to during development.
//
// It reuses the handler.Handler that Vercel deploys as a serverless function,
// but swaps in an unrestricted policy so requests to localhost and private
// networks work during development.
//
// This file deliberately lives OUTSIDE api/: Vercel's zero-config Go builder
// discovers serverless functions with the glob "api/**/!(*_test).go", which is
// recursive, so any .go file at any depth under api/ would be built as an
// additional function. Keeping it here makes that impossible.
package main

import (
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"time"

	handler "github.com/krockxz/gostman/api"
	"github.com/krockxz/gostman/engine"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8787"
	}

	handler.Policy = engine.Policy{}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/proxy", loopbackOnly(handler.Handler))

	addr := "127.0.0.1:" + port
	srv := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Printf("Starting local proxy server on http://%s/api/proxy", addr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("Server failed: %v", err)
	}
}

func loopbackOnly(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !isLoopbackHost(r.Host) || !isLoopbackHost(r.Header.Get("X-Forwarded-Host")) {
			http.Error(w, "the local proxy only answers requests addressed to localhost", http.StatusForbidden)
			return
		}
		next(w, r)
	}
}

func isLoopbackHost(hostport string) bool {
	if hostport == "" {
		return true
	}
	host := hostport
	if name, _, err := net.SplitHostPort(hostport); err == nil {
		host = name
	}
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
