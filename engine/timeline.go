package engine

import (
	"crypto/tls"
	"io"
	"net"
	"net/http"
	"net/http/httptrace"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/idna"

	"github.com/kunalgoesbyken/gostman/redact"
)

const (
	maxTimelineHops = 40
	maskedValue     = "••••••••"

	pseudoHeaderPrefix = ":"

	PhaseDNS      = "dns"
	PhaseConnect  = "connect"
	PhaseTLS      = "tls"
	PhaseRequest  = "request"
	PhaseResponse = "response"
	PhaseDownload = "download"
)

type TimelineHeader struct {
	Key    string `json:"key"`
	Value  string `json:"value"`
	Masked bool   `json:"masked,omitempty"`
	Secret string `json:"secret,omitempty"`
}

type TLSInfo struct {
	Version  string `json:"version"`
	Cipher   string `json:"cipher"`
	Protocol string `json:"protocol,omitempty"`
	Subject  string `json:"subject,omitempty"`
	Issuer   string `json:"issuer,omitempty"`
	NotAfter string `json:"notAfter,omitempty"`
}

type Phases struct {
	DNSMs       float64 `json:"dnsMs"`
	ConnectMs   float64 `json:"connectMs"`
	TLSMs       float64 `json:"tlsMs"`
	FirstByteMs float64 `json:"firstByteMs"`
	DownloadMs  float64 `json:"downloadMs"`
}

type Hop struct {
	Method       string           `json:"method"`
	URL          string           `json:"url"`
	Status       int              `json:"status,omitempty"`
	Proto        string           `json:"proto,omitempty"`
	Location     string           `json:"location,omitempty"`
	Remote       string           `json:"remote,omitempty"`
	Reused       bool             `json:"reused"`
	RequestBytes int64            `json:"requestBytes"`
	Sent         []TimelineHeader `json:"sent"`
	Received     []TimelineHeader `json:"received"`
	CookiesSet   []string         `json:"cookiesSet,omitempty"`
	TLS          *TLSInfo         `json:"tls,omitempty"`
	StartMs      float64          `json:"startMs"`
	TotalMs      float64          `json:"totalMs"`
	Phases       Phases           `json:"phases"`
	FailedPhase  string           `json:"failedPhase,omitempty"`
}

type Timeline struct {
	Hops    []Hop   `json:"hops"`
	Omitted int     `json:"omitted,omitempty"`
	TotalMs float64 `json:"totalMs"`
	Proxied bool    `json:"proxied,omitempty"`
}

func MarkProxied(response Response) Response {
	if response.Timeline != nil {
		response.Timeline.Proxied = true
	}
	return response
}

type span struct {
	start time.Time
	end   time.Time
	err   error
}

func (s *span) open(at time.Time) {
	if s.start.IsZero() {
		s.start = at
	}
}

func (s *span) close(at time.Time, err error) {
	if s.end.IsZero() || err == nil {
		s.end, s.err = at, err
	}
}

func (s span) duration() time.Duration {
	return elapsed(s.start, s.end)
}

func (s span) failed() bool {
	return !s.start.IsZero() && (s.end.IsZero() || s.err != nil)
}

func elapsed(from, to time.Time) time.Duration {
	if from.IsZero() || to.IsZero() || to.Before(from) {
		return 0
	}
	return to.Sub(from)
}

func milliseconds(d time.Duration) float64 {
	return float64(d) / float64(time.Millisecond)
}

type hopRecord struct {
	mu sync.Mutex

	begin        time.Time
	end          time.Time
	gotConn      time.Time
	wroteRequest time.Time
	firstByte    time.Time
	dns          span
	connect      span
	tls          span

	method       string
	url          string
	requestBytes int64
	remote       string
	reused       bool
	tlsInfo      *TLSInfo
	sent         []TimelineHeader
	status       int
	proto        string
	location     string
	received     []TimelineHeader
	cookiesSet   []string
	answered     bool
	failed       bool
	bodyFailed   bool
	reveal       bool
}

func (h *hopRecord) observe(update func(now time.Time)) {
	h.mu.Lock()
	defer h.mu.Unlock()
	update(time.Now())
}

func (h *hopRecord) trace() *httptrace.ClientTrace {
	return &httptrace.ClientTrace{
		DNSStart:          func(httptrace.DNSStartInfo) { h.observe(h.dns.open) },
		DNSDone:           func(info httptrace.DNSDoneInfo) { h.observe(func(now time.Time) { h.dns.close(now, info.Err) }) },
		ConnectStart:      func(string, string) { h.observe(h.connect.open) },
		ConnectDone:       func(_, _ string, err error) { h.observe(func(now time.Time) { h.connect.close(now, err) }) },
		TLSHandshakeStart: func() { h.observe(h.tls.open) },
		TLSHandshakeDone: func(_ tls.ConnectionState, err error) {
			h.observe(func(now time.Time) { h.tls.close(now, err) })
		},
		GotConn:              func(info httptrace.GotConnInfo) { h.observe(func(now time.Time) { h.connected(now, info) }) },
		WroteHeaderField:     func(key string, values []string) { h.observe(func(time.Time) { h.wroteHeader(key, values) }) },
		WroteRequest:         func(httptrace.WroteRequestInfo) { h.observe(func(now time.Time) { h.wroteRequest = now }) },
		GotFirstResponseByte: func() { h.observe(func(now time.Time) { h.firstByte = now }) },
	}
}

func (h *hopRecord) connected(now time.Time, info httptrace.GotConnInfo) {
	h.gotConn, h.reused, h.sent = now, info.Reused, nil
	h.remote = info.Conn.RemoteAddr().String()
	if secured, ok := info.Conn.(*tls.Conn); ok {
		h.tlsInfo = describeTLS(secured.ConnectionState())
	}
}

func (h *hopRecord) wroteHeader(key string, values []string) {
	for _, value := range values {
		h.sent = append(h.sent, h.header(key, value))
	}
}

func (h *hopRecord) header(key, value string) TimelineHeader {
	if strings.HasPrefix(key, pseudoHeaderPrefix) || !redact.IsSensitiveName(key) {
		return TimelineHeader{Key: key, Value: value}
	}
	masked := TimelineHeader{Key: key, Value: maskedValue, Masked: true}
	if h.reveal {
		masked.Secret = value
	}
	return masked
}

func (h *hopRecord) headers(source http.Header) []TimelineHeader {
	keys := make([]string, 0, len(source))
	for key := range source {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var entries []TimelineHeader
	for _, key := range keys {
		for _, value := range source[key] {
			entries = append(entries, h.header(key, value))
		}
	}
	return entries
}

func (h *hopRecord) respond(response *http.Response, err error) {
	h.observe(func(now time.Time) {
		if err != nil {
			h.end, h.failed = now, true
			return
		}
		h.answered = true
		h.status, h.proto = response.StatusCode, response.Proto
		h.location = response.Header.Get("Location")
		h.received = h.headers(response.Header)
		for _, cookie := range response.Cookies() {
			h.cookiesSet = append(h.cookiesSet, cookie.Name)
		}
	})
}

func (h *hopRecord) finish(err error) {
	h.observe(func(now time.Time) {
		if h.end.IsZero() {
			h.end = now
		}
		h.bodyFailed = h.bodyFailed || (err != nil && err != io.EOF)
	})
}

func (h *hopRecord) failedPhase() string {
	if h.bodyFailed {
		return PhaseDownload
	}
	if !h.failed {
		return ""
	}
	switch {
	case h.dns.failed():
		return PhaseDNS
	case h.connect.failed():
		return PhaseConnect
	case h.tls.failed():
		return PhaseTLS
	case h.gotConn.IsZero():
		return ""
	case h.wroteRequest.IsZero():
		return PhaseRequest
	default:
		return PhaseResponse
	}
}

func (h *hopRecord) snapshot(origin time.Time, now time.Time) Hop {
	h.mu.Lock()
	defer h.mu.Unlock()
	end := h.end
	if end.IsZero() {
		end = now
	}
	waitEnd := h.firstByte
	if waitEnd.IsZero() {
		waitEnd = end
	}
	return Hop{
		Method:       h.method,
		URL:          h.url,
		Status:       h.status,
		Proto:        h.proto,
		Location:     h.location,
		Remote:       h.remote,
		Reused:       h.reused,
		RequestBytes: h.requestBytes,
		Sent:         h.sent,
		Received:     h.received,
		CookiesSet:   h.cookiesSet,
		TLS:          h.tlsInfo,
		StartMs:      milliseconds(elapsed(origin, h.begin)),
		TotalMs:      milliseconds(elapsed(h.begin, end)),
		FailedPhase:  h.failedPhase(),
		Phases: Phases{
			DNSMs:       milliseconds(h.dns.duration()),
			ConnectMs:   milliseconds(h.connect.duration()),
			TLSMs:       milliseconds(h.tls.duration()),
			FirstByteMs: milliseconds(elapsed(h.gotConn, waitEnd)),
			DownloadMs:  milliseconds(elapsed(h.firstByte, end)),
		},
	}
}

func describeTLS(state tls.ConnectionState) *TLSInfo {
	info := &TLSInfo{
		Version:  tls.VersionName(state.Version),
		Cipher:   tls.CipherSuiteName(state.CipherSuite),
		Protocol: state.NegotiatedProtocol,
	}
	if len(state.PeerCertificates) == 0 {
		return info
	}
	leaf := state.PeerCertificates[0]
	info.Subject, info.Issuer = leaf.Subject.String(), leaf.Issuer.String()
	info.NotAfter = leaf.NotAfter.UTC().Format(time.RFC3339)
	return info
}

func displayURL(target *url.URL) string {
	shown := *target
	shown.Host = asciiHost(target)
	return shown.String()
}

func asciiHost(target *url.URL) string {
	name, err := idna.Lookup.ToASCII(target.Hostname())
	if err != nil || name == target.Hostname() {
		return target.Host
	}
	if port := target.Port(); port != "" {
		return net.JoinHostPort(name, port)
	}
	return name
}

type recorder struct {
	mu      sync.Mutex
	origin  time.Time
	reveal  bool
	hops    []*hopRecord
	omitted int
}

func newRecorder(reveal bool) *recorder {
	return &recorder{origin: time.Now(), reveal: reveal}
}

func (r *recorder) begin(request *http.Request) *hopRecord {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.hops) >= maxTimelineHops {
		r.omitted++
		return nil
	}
	hop := &hopRecord{
		begin:        time.Now(),
		method:       request.Method,
		url:          displayURL(request.URL),
		requestBytes: max(request.ContentLength, 0),
		reveal:       r.reveal,
	}
	r.hops = append(r.hops, hop)
	return hop
}

func (r *recorder) finish() *Timeline {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.hops) == 0 {
		return nil
	}
	now := time.Now()
	timeline := &Timeline{Hops: make([]Hop, 0, len(r.hops)), Omitted: r.omitted, TotalMs: milliseconds(now.Sub(r.origin))}
	for _, hop := range r.hops {
		timeline.Hops = append(timeline.Hops, hop.snapshot(r.origin, now))
	}
	return timeline
}

func (r *recorder) wrap(next http.RoundTripper) http.RoundTripper {
	return tracedTransport{recorder: r, next: next}
}

type tracedTransport struct {
	recorder *recorder
	next     http.RoundTripper
}

func (t tracedTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	hop := t.recorder.begin(request)
	if hop == nil {
		return t.next.RoundTrip(request)
	}
	traced := request.WithContext(httptrace.WithClientTrace(request.Context(), hop.trace()))
	response, err := t.next.RoundTrip(traced)
	hop.respond(response, err)
	if err != nil {
		return response, err
	}
	response.Body = timedBody{ReadCloser: response.Body, hop: hop}
	return response, nil
}

type timedBody struct {
	io.ReadCloser
	hop *hopRecord
}

func (b timedBody) Read(buffer []byte) (int, error) {
	count, err := b.ReadCloser.Read(buffer)
	if err != nil {
		b.hop.finish(err)
	}
	return count, err
}

func (b timedBody) Close() error {
	b.hop.finish(nil)
	return b.ReadCloser.Close()
}
