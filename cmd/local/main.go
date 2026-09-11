// Command local runs the /api/proxy endpoint on a local HTTP server so the web
// frontend (`npm run dev:web`) has something to proxy to during development.
//
// It reuses the exact same handler.Handler that Vercel deploys as a serverless
// function, so local behaviour matches production, SSRF guards included.
//
// This file deliberately lives OUTSIDE api/: Vercel's zero-config Go builder
// discovers serverless functions with the glob "api/**/!(*_test).go", which is
// recursive, so any .go file at any depth under api/ would be built as an
// additional function. Keeping it here makes that impossible.
package main

import (
	"errors"
	"log"
	"net/http"
	"os"
	"time"

	"handler"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8787"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/proxy", handler.Handler)

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
