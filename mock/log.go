package mock

import (
	"encoding/json"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/kunalgoesbyken/gostman/redact"
)

const (
	logCapacity   = 500
	maxLoggedBody = 4 << 10
	queryJoin     = "&"
	queryAssign   = "="
	queryStart    = "?"
)

type journal struct {
	mu      sync.Mutex
	entries []Entry
	last    int64
}

func (j *journal) add(entry Entry) Entry {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.last++
	entry.ID = j.last
	if len(j.entries) == logCapacity {
		j.entries = append(j.entries[:0], j.entries[1:]...)
	}
	j.entries = append(j.entries, entry)
	return entry
}

func (j *journal) snapshot() []Entry {
	j.mu.Lock()
	defer j.mu.Unlock()
	return append([]Entry{}, j.entries...)
}

func (j *journal) clear() {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.entries = nil
}

func maskedHeaders(header http.Header) []Header {
	names := make([]string, 0, len(header))
	for name := range header {
		names = append(names, name)
	}
	sort.Strings(names)
	masked := make([]Header, 0, len(header))
	for _, name := range names {
		for _, value := range header[name] {
			masked = append(masked, Header{Key: name, Value: maskedValue(name, value)})
		}
	}
	return masked
}

func maskedValue(name, value string) string {
	if redact.IsSensitiveName(name) {
		return redact.Masked
	}
	return value
}

func maskedTarget(target *url.URL) string {
	if target.RawQuery == "" {
		return target.EscapedPath()
	}
	pairs := strings.Split(target.RawQuery, queryJoin)
	for i, pair := range pairs {
		name, _, assigned := strings.Cut(pair, queryAssign)
		if !assigned {
			continue
		}
		decoded, err := url.QueryUnescape(name)
		if err != nil {
			decoded = name
		}
		if redact.IsSensitiveName(decoded) {
			pairs[i] = name + queryAssign + redact.Masked
		}
	}
	return target.EscapedPath() + queryStart + strings.Join(pairs, queryJoin)
}

func maskedBody(body []byte) []byte {
	var document any
	if json.Unmarshal(body, &document) != nil {
		return body
	}
	if !redact.MapSensitive(document, func(string, string) string { return redact.Masked }) {
		return body
	}
	masked, err := json.Marshal(document)
	if err != nil {
		return body
	}
	return masked
}

func loggedBody(body []byte) string {
	body = maskedBody(body)
	end := min(len(body), maxLoggedBody)
	for end > 0 && end < len(body) && !utf8.RuneStart(body[end]) {
		end--
	}
	if !utf8.Valid(body[:end]) {
		return ""
	}
	return string(body[:end])
}
