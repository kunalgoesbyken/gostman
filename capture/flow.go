package capture

import (
	"bytes"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/mock"
)

const (
	injectedMessage = "Gostman capture injected this failure."
	textMediaType   = "text/plain; charset=utf-8"
)

var methodToken = regexp.MustCompile(`^[A-Za-z]{1,32}$`)

func (s *Server) prepare(w http.ResponseWriter, r *http.Request, take *recording) bool {
	p := take.plan
	if p.isEmpty() {
		return true
	}
	if !mock.Pause(r.Context(), p.delay) {
		return false
	}
	if p.fault.Percent > 0 {
		s.fail(w, r, take, p.fault)
		return false
	}
	if p.answer != nil {
		s.respondFrom(w, r, take, p.answer)
		return false
	}
	applyHeaders(r.Header, p.requestEdits)
	take.target = p.remote
	if p.editsRequest() || p.breakRequest != "" {
		return s.reworkRequest(r, take)
	}
	return true
}

func (s *Server) fail(w http.ResponseWriter, r *http.Request, take *recording, fault mock.Fault) {
	take.exchange.URL = s.destination(r, take).String()
	if fault.Mode() == mock.FaultStatus {
		header := http.Header{"Content-Type": {textMediaType}}
		s.serveLocal(w, r, take, fault.Code(), header, []byte(injectedMessage))
		return
	}
	take.failed(0, "connection closed by a capture rule")
	mock.Drop(w, fault.Mode() == mock.FaultReset)
}

func (s *Server) serveLocal(w http.ResponseWriter, r *http.Request, take *recording, status int, header http.Header, body []byte) {
	take.exchange.URL = s.destination(r, take).String()
	out := w.Header()
	for name, values := range header {
		out[name] = values
	}
	out.Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(status)
	if r.Method != http.MethodHead && status != http.StatusNoContent && status != http.StatusNotModified {
		writeSlowly(r.Context(), w, body, take.plan.throttle.DownloadKBps)
	}
	take.exchange.Status = status
	take.answer = header.Clone()
	take.answer.Set("Content-Length", strconv.Itoa(len(body)))
	take.received.add(body, true)
}

func (s *Server) respondFrom(w http.ResponseWriter, r *http.Request, take *recording, answer *Answer) {
	status, header, body, err := s.materialize(answer)
	if err != nil {
		header = http.Header{"Content-Type": {textMediaType}}
		s.serveLocal(w, r, take, http.StatusBadGateway, header, []byte(err.Error()))
		return
	}
	s.serveLocal(w, r, take, status, header, body)
}

func (s *Server) materialize(answer *Answer) (int, http.Header, []byte, error) {
	status := answer.Status
	if status == 0 {
		status = http.StatusOK
	}
	header := http.Header{}
	for _, row := range answer.Headers {
		if name := strings.TrimSpace(row.Key); name != "" {
			header.Add(name, row.Value)
		}
	}
	body, err := s.answerBody(answer)
	if err != nil {
		return 0, nil, nil, err
	}
	if header.Get("Content-Type") == "" {
		header.Set("Content-Type", s.answerType(answer, body))
	}
	header.Del("Content-Length")
	return status, header, body, nil
}

func (s *Server) answerBody(answer *Answer) ([]byte, error) {
	if answer.File == "" {
		return decodedBody(answer.Body, answer.BodyEncoding)
	}
	root, err := os.OpenRoot(s.root)
	if err != nil {
		return nil, fmt.Errorf("Gostman capture could not open the folder to read %s from: %w", answer.File, err)
	}
	defer root.Close()
	file, err := root.Open(filepath.FromSlash(strings.TrimPrefix(answer.File, "/")))
	if err != nil {
		return nil, fmt.Errorf("Gostman capture could not read %s: %w", answer.File, err)
	}
	defer file.Close()
	body, err := io.ReadAll(io.LimitReader(file, maxAnswerBytes+1))
	if err != nil || len(body) > maxAnswerBytes {
		return nil, fmt.Errorf("Gostman capture could not read %s within %d MB", answer.File, maxAnswerBytes>>20)
	}
	return body, nil
}

func (s *Server) answerType(answer *Answer, body []byte) string {
	if answer.ContentType != "" {
		return answer.ContentType
	}
	if known := mime.TypeByExtension(filepath.Ext(answer.File)); answer.File != "" && known != "" {
		return known
	}
	return http.DetectContentType(body)
}

func bufferedBody(source io.ReadCloser) ([]byte, io.ReadCloser, bool) {
	data, err := io.ReadAll(io.LimitReader(source, bodyLimit+1))
	if err != nil || len(data) > bodyLimit {
		return data, readerWith(data, source), false
	}
	source.Close()
	return data, nil, true
}

type joinedBody struct {
	io.Reader
	closer io.Closer
}

func (j joinedBody) Close() error {
	return j.closer.Close()
}

func readerWith(head []byte, rest io.ReadCloser) io.ReadCloser {
	return joinedBody{Reader: io.MultiReader(bytes.NewReader(head), rest), closer: rest}
}

func replacedBody(r *http.Request, body []byte) {
	r.Body = io.NopCloser(bytes.NewReader(body))
	r.ContentLength = int64(len(body))
	r.Header.Del("Content-Length")
}

func (s *Server) reworkRequest(r *http.Request, take *recording) bool {
	p := take.plan
	body, rest, whole := bufferedBody(r.Body)
	if !whole {
		r.Body = rest
		take.note("request too large to hold or edit")
		return true
	}
	if r.Header.Get(headerContentEncoding) == "" && p.editsRequest() {
		body = applyBody(body, p.requestEdits)
	}
	replacedBody(r, body)
	if p.breakRequest == "" {
		return true
	}
	return s.holdRequest(r, take, body)
}

func (s *Server) holdRequest(r *http.Request, take *recording, body []byte) bool {
	text, encoding := engine.EncodeBody(body, false)
	take.exchange.URL = s.destination(r, take).String()
	decision, outcome := s.hold(r.Context(), Held{
		Phase:        PhaseRequest,
		Rule:         take.plan.breakRequest,
		Method:       r.Method,
		URL:          s.destination(r, take).String(),
		Headers:      sortedHeaders(r.Header),
		Body:         text,
		BodyEncoding: encoding,
	})
	take.note(PhaseRequest + " " + outcome.label())
	switch outcome {
	case verdictDropped:
		take.failed(0, droppedReason)
		panic(http.ErrAbortHandler)
	case verdictEdited:
		s.applyRequestDecision(r, take, decision)
	}
	return true
}

func (s *Server) applyRequestDecision(r *http.Request, take *recording, decision Decision) {
	if decision.Method != "" {
		r.Method = strings.ToUpper(decision.Method)
	}
	if edited, err := url.Parse(decision.URL); err == nil && decision.URL != "" && edited.Host != "" {
		take.override = edited
	}
	r.Header = headerFrom(decision.Headers)
	if body, err := decodedBody(decision.Body, decision.BodyEncoding); err == nil {
		replacedBody(r, body)
	}
}

func headerFrom(entries []engine.HeaderEntry) http.Header {
	header := http.Header{}
	for _, entry := range entries {
		if name := strings.TrimSpace(entry.Key); name != "" {
			header.Add(name, entry.Value)
		}
	}
	return header
}

func hasResponseBody(response *http.Response) bool {
	status := response.StatusCode
	return response.Request.Method != http.MethodHead && status != http.StatusNoContent && status != http.StatusNotModified
}

func (s *Server) reshape(response *http.Response, take *recording) error {
	p := take.plan
	if p.isEmpty() {
		return nil
	}
	applyHeaders(response.Header, p.responseEdits)
	if (p.editsResponse() || p.breakResponse != "") && hasResponseBody(response) {
		if err := s.reworkResponse(response, take); err != nil {
			return err
		}
	}
	response.Body = slowed(response.Request.Context(), response.Body, p.throttle.DownloadKBps)
	return nil
}

func (s *Server) reworkResponse(response *http.Response, take *recording) error {
	p := take.plan
	body, rest, whole := bufferedBody(response.Body)
	if !whole {
		response.Body = rest
		take.note("response too large to hold or edit")
		return nil
	}
	if isGzipped(response.Header) {
		decoded, complete := gunzip(body)
		if !complete {
			response.Body = io.NopCloser(bytes.NewReader(body))
			take.note("response could not be decoded to hold or edit")
			return nil
		}
		body = decoded
		response.Header.Del(headerContentEncoding)
	}
	body = applyBody(body, p.responseEdits)
	if p.breakResponse != "" {
		var err error
		if body, err = s.holdResponse(response, take, body); err != nil {
			return err
		}
	}
	setResponseBody(response, body)
	return nil
}

func setResponseBody(response *http.Response, body []byte) {
	response.Body = io.NopCloser(bytes.NewReader(body))
	response.ContentLength = int64(len(body))
	response.Header.Set("Content-Length", strconv.Itoa(len(body)))
}

func (s *Server) holdResponse(response *http.Response, take *recording, body []byte) ([]byte, error) {
	text, encoding := engine.EncodeBody(body, false)
	decision, outcome := s.hold(response.Request.Context(), Held{
		Phase:        PhaseResponse,
		Rule:         take.plan.breakResponse,
		Method:       response.Request.Method,
		URL:          response.Request.URL.String(),
		Status:       response.StatusCode,
		Headers:      sortedHeaders(response.Header),
		Body:         text,
		BodyEncoding: encoding,
	})
	take.note(PhaseResponse + " " + outcome.label())
	switch outcome {
	case verdictDropped:
		return nil, errDropped
	case verdictEdited:
		return s.applyResponseDecision(response, decision, body), nil
	}
	return body, nil
}

func (s *Server) applyResponseDecision(response *http.Response, decision Decision, original []byte) []byte {
	if decision.Status >= 100 && decision.Status <= 599 {
		response.StatusCode = decision.Status
		response.Status = strconv.Itoa(decision.Status) + " " + http.StatusText(decision.Status)
	}
	response.Header = headerFrom(decision.Headers)
	response.Header.Del(headerContentEncoding)
	if body, err := decodedBody(decision.Body, decision.BodyEncoding); err == nil {
		return body
	}
	return original
}
