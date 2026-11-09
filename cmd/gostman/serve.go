package main

import (
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path"
	"strings"
	"time"

	handler "github.com/kunalgoesbyken/gostman/api"
	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	serveDefaultAddr   = "127.0.0.1:8080"
	serveReadTimeout   = time.Minute
	serveWriteTimeout  = 2 * time.Minute
	serveIdleTimeout   = 2 * time.Minute
	siteEntry          = "index.html"
	siteNotFound       = "404.html"
	apiPrefix          = "/api/"
	immutableCache     = "public, max-age=31536000, immutable"
	sandboxPolicy      = "default-src 'none'; script-src 'unsafe-eval'"
	allowPrivateNotice = "Warning: --allow-private lets anyone who can reach this server send requests to this computer and its network through it."
)

type headerRule struct {
	exact   string
	prefix  string
	headers map[string]string
}

func (r headerRule) applies(urlPath string) bool {
	if r.exact != "" {
		return urlPath == r.exact
	}
	return strings.HasPrefix(urlPath, r.prefix)
}

var siteHeaderRules = []headerRule{
	{exact: "/sw.js", headers: map[string]string{"Cache-Control": "no-cache", "Service-Worker-Allowed": "/"}},
	{exact: "/manifest.webmanifest", headers: map[string]string{"Content-Type": "application/manifest+json"}},
	{prefix: "/assets/", headers: map[string]string{"Cache-Control": immutableCache}},
	{prefix: "/docs-images/", headers: map[string]string{"Cache-Control": immutableCache}},
	{prefix: "/assets/sandbox.worker.", headers: map[string]string{"Content-Security-Policy": sandboxPolicy}},
}

var siteRewrites = map[string]string{"/oauth-callback": "/" + siteEntry}

type site struct {
	root *os.Root
}

func openSite(dir string) (*os.Root, error) {
	root, err := os.OpenRoot(dir)
	if err != nil {
		return nil, fmt.Errorf("--dir %q could not be opened: %w", dir, err)
	}
	if _, err := root.Stat(siteEntry); err != nil {
		root.Close()
		return nil, fmt.Errorf("--dir %q has no %s; give the folder that npm run build:web wrote (dist-web)", dir, siteEntry)
	}
	return root, nil
}

func (s site) regular(name string) (*os.File, os.FileInfo) {
	file, err := s.root.Open(name)
	if err != nil {
		return nil, nil
	}
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		file.Close()
		return nil, nil
	}
	return file, info
}

func (s site) lookup(urlPath string) (*os.File, os.FileInfo) {
	name := strings.TrimPrefix(path.Clean(urlPath), "/")
	if name == "" {
		name = "."
	}
	for _, candidate := range []string{name, path.Join(name, siteEntry)} {
		if file, info := s.regular(candidate); file != nil {
			return file, info
		}
	}
	return nil, nil
}

func applyHeaderRules(header http.Header, urlPath string) {
	lowered := strings.ToLower(urlPath)
	for _, rule := range siteHeaderRules {
		if !rule.applies(lowered) {
			continue
		}
		for name, value := range rule.headers {
			header.Set(name, value)
		}
	}
}

func (s site) notFound(w http.ResponseWriter) {
	file, _ := s.regular(siteNotFound)
	if file == nil {
		http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
		return
	}
	defer file.Close()
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusNotFound)
	io.Copy(w, file)
}

func (s site) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	served := r.URL.Path
	if target, rewritten := siteRewrites[served]; rewritten {
		served = target
	}
	file, info := s.lookup(served)
	if file == nil {
		s.notFound(w)
		return
	}
	defer file.Close()
	applyHeaderRules(w.Header(), r.URL.Path)
	http.ServeContent(w, r, info.Name(), info.ModTime(), file)
}

func newServeHandler(files site) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc(relayPath, handler.Handler)
	mux.Handle(apiPrefix, http.NotFoundHandler())
	mux.Handle("/", files)
	return mux
}

func proxyPolicy(allowPrivate bool) engine.Policy {
	policy := handler.Policy
	policy.BlockPrivate = !allowPrivate
	return policy
}

func serveWebApp(root *os.Root, addr string, allowPrivate bool, stdout, stderr io.Writer) error {
	handler.Policy = proxyPolicy(allowPrivate)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("--addr %q could not be opened: %w", addr, err)
	}
	server := &http.Server{
		Handler:           newServeHandler(site{root: root}),
		ReadHeaderTimeout: headerTimeout,
		ReadTimeout:       serveReadTimeout,
		WriteTimeout:      serveWriteTimeout,
		IdleTimeout:       serveIdleTimeout,
	}
	if allowPrivate {
		fmt.Fprintln(stderr, allowPrivateNotice)
	}
	fmt.Fprintf(stdout, "Gostman web app from %s at http://%s\nPress Ctrl+C to stop.\n", root.Name(), listener.Addr())
	return serveServerUntilInterrupted(listener, server)
}

func serveCommand(arguments []string, stdout, stderr *os.File) int {
	flags := flag.NewFlagSet("serve", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	dir := flags.String("dir", "", "")
	addr := flags.String("addr", serveDefaultAddr, "")
	allowPrivate := flags.Bool("allow-private", false, "")
	positional, err := parseInterspersed(flags, arguments)
	switch {
	case err != nil:
		return misuse(stderr, err.Error())
	case len(positional) > 0:
		return misuse(stderr, "serve takes flags only")
	case *dir == "":
		return misuse(stderr, "serve needs --dir, the folder that npm run build:web wrote (dist-web)")
	}
	root, err := openSite(*dir)
	if err != nil {
		return misuse(stderr, err.Error())
	}
	defer root.Close()
	if err := serveWebApp(root, *addr, *allowPrivate, stdout, stderr); err != nil {
		return complain(stderr, err)
	}
	return exitPassed
}
