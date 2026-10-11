package main

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"html"
	"net"
	"net/http"
	"net/url"
	"time"

	"github.com/krockxz/gostman/engine"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	authorizationTimeout = 5 * time.Minute
	authorizationKey     = "oauth-authorization"
	callbackPage         = `<!doctype html><meta charset="utf-8"><title>Gostman</title><body style="font-family:sans-serif;padding:2rem">%s You can close this tab and return to Gostman.</body>`
)

type AuthorizationResult struct {
	Code         string `json:"code"`
	CodeVerifier string `json:"codeVerifier"`
	RedirectURI  string `json:"redirectUri"`
}

type callbackOutcome struct {
	code string
	err  error
}

func loopbackListener(redirectURI string) (net.Listener, string, error) {
	callback, err := url.Parse(redirectURI)
	if err != nil || callback.Scheme != "http" || callback.Port() == "" {
		return nil, "", fmt.Errorf("the callback URL must look like http://localhost:9876/callback")
	}
	address := net.ParseIP(callback.Hostname())
	if callback.Hostname() != "localhost" && (address == nil || !address.IsLoopback()) {
		return nil, "", fmt.Errorf("the callback URL must point at localhost so Gostman can receive the sign-in result")
	}
	listener, err := net.Listen("tcp", net.JoinHostPort("127.0.0.1", callback.Port()))
	if err != nil {
		return nil, "", fmt.Errorf("port %s is not free for the callback: %w", callback.Port(), err)
	}
	path := callback.Path
	if path == "" {
		path = "/"
	}
	return listener, path, nil
}

func readCallback(query url.Values) callbackOutcome {
	switch {
	case query.Get("error") != "":
		reason := query.Get("error_description")
		if reason == "" {
			reason = query.Get("error")
		}
		return callbackOutcome{err: fmt.Errorf("the provider refused the sign-in: %s", reason)}
	case query.Get("code") == "":
		return callbackOutcome{err: errors.New("the provider did not return an authorization code")}
	default:
		return callbackOutcome{code: query.Get("code")}
	}
}

func awaitCallback(ctx context.Context, listener net.Listener, path, state string) (string, error) {
	outcomes := make(chan callbackOutcome, 1)
	mux := http.NewServeMux()
	mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
		if subtle.ConstantTimeCompare([]byte(r.URL.Query().Get("state")), []byte(state)) != 1 {
			http.Error(w, "this sign-in answer does not belong to a pending request", http.StatusBadRequest)
			return
		}
		outcome := readCallback(r.URL.Query())
		message := "Signed in."
		if outcome.err != nil {
			message = "Sign-in failed: " + outcome.err.Error() + "."
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprintf(w, callbackPage, html.EscapeString(message))
		select {
		case outcomes <- outcome:
		default:
		}
	})
	server := &http.Server{Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	go server.Serve(listener)
	defer server.Close()

	select {
	case outcome := <-outcomes:
		return outcome.code, outcome.err
	case <-ctx.Done():
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return "", errors.New("no sign-in arrived within five minutes")
		}
		return "", errors.New("the sign-in was cancelled")
	}
}

func (a *App) Authorize(config engine.OAuth2, variables string) (AuthorizationResult, error) {
	started, err := engine.StartAuthorization(config, variables)
	if err != nil {
		return AuthorizationResult{}, err
	}
	listener, path, err := loopbackListener(started.RedirectURI)
	if err != nil {
		return AuthorizationResult{}, err
	}
	ctx, cancel := context.WithTimeout(a.ctx, authorizationTimeout)
	a.track(authorizationKey, cancel)
	defer a.release(authorizationKey)

	wailsruntime.BrowserOpenURL(a.ctx, started.URL)
	code, err := awaitCallback(ctx, listener, path, started.State)
	if err != nil {
		return AuthorizationResult{}, err
	}
	return AuthorizationResult{Code: code, CodeVerifier: started.CodeVerifier, RedirectURI: started.RedirectURI}, nil
}

func (a *App) CancelAuthorization() {
	a.CancelRequest(authorizationKey)
}

func (a *App) FetchToken(exchange engine.TokenExchange) engine.Token {
	return engine.FetchToken(a.ctx, exchange, a.policy())
}
