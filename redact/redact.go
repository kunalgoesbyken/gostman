package redact

import (
	"bytes"
	"encoding/json"
	"sort"
	"strings"
	"sync"
	"unicode/utf8"
)

const (
	markerOpen  = "{{"
	markerClose = "}}"
	growth      = 2
)

type form struct {
	text  string
	label string
}

type span struct {
	start int
	end   int
	width int
	label string
}

type Redactor struct {
	mu     sync.RWMutex
	known  map[string]bool
	forms  []form
	margin int
}

func New() *Redactor {
	return &Redactor{known: map[string]bool{}}
}

func Marker(label string) string {
	return markerOpen + label + markerClose
}

func (r *Redactor) Learn(label, value string) {
	value = strings.TrimSpace(value)
	if !IsMeaningful(value) {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.known[value] {
		return
	}
	r.known[value] = true
	for _, variant := range variants(value) {
		r.forms = append(r.forms, form{text: variant, label: label})
		r.margin = max(r.margin, len(variant))
	}
}

func (r *Redactor) longest() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.margin
}

func occurrences(text string, wanted form) []span {
	var found []span
	for offset := 0; ; {
		index := strings.Index(text[offset:], wanted.text)
		if index < 0 {
			return found
		}
		start := offset + index
		found = append(found, span{start: start, end: start + len(wanted.text), width: len(wanted.text), label: wanted.label})
		offset = start + 1
	}
}

func merge(found []span) []span {
	sort.SliceStable(found, func(i, j int) bool { return found[i].start < found[j].start })
	var merged []span
	for _, next := range found {
		if len(merged) == 0 || next.start >= merged[len(merged)-1].end {
			merged = append(merged, next)
			continue
		}
		last := &merged[len(merged)-1]
		last.end = max(last.end, next.end)
		if next.width > last.width {
			last.width, last.label = next.width, next.label
		}
	}
	return merged
}

func (r *Redactor) spans(text string) []span {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var found []span
	for _, wanted := range r.forms {
		found = append(found, occurrences(text, wanted)...)
	}
	return merge(found)
}

func (r *Redactor) Text(text string) string {
	found := r.spans(text)
	if len(found) == 0 {
		return text
	}
	var cleaned strings.Builder
	position := 0
	for _, hit := range found {
		cleaned.WriteString(text[position:hit.start])
		cleaned.WriteString(Marker(hit.label))
		position = hit.end
	}
	cleaned.WriteString(text[position:])
	return cleaned.String()
}

func cutAtRune(text string, limit int) string {
	if len(text) <= limit {
		return text
	}
	limit = max(limit, 0)
	for limit > 0 && !utf8.RuneStart(text[limit]) {
		limit--
	}
	return text[:limit]
}

func (r *Redactor) Excerpt(text string, limit int) (string, bool) {
	margin := r.longest()
	for size := max(limit+margin, 1); ; size *= growth {
		window := cutAtRune(text, size)
		cleaned := r.Text(window)
		if len(window) == len(text) {
			return cutAtRune(cleaned, limit), len(cleaned) > limit
		}
		if settled := cutAtRune(cleaned, len(cleaned)-margin); len(settled) >= limit {
			return cutAtRune(settled, limit), true
		}
	}
}

func (r *Redactor) Find(text string) (string, bool) {
	found := r.spans(text)
	if len(found) == 0 {
		return "", false
	}
	return found[0].label, true
}

func (r *Redactor) tree(node any) any {
	switch value := node.(type) {
	case string:
		return r.Text(value)
	case []any:
		for index, item := range value {
			value[index] = r.tree(item)
		}
		return value
	case map[string]any:
		cleaned := make(map[string]any, len(value))
		for key, item := range value {
			cleaned[r.Text(key)] = r.tree(item)
		}
		return cleaned
	default:
		return node
	}
}

func Clean[T any](r *Redactor, value T) (T, error) {
	var cleaned T
	encoded, err := json.Marshal(value)
	if err != nil {
		return cleaned, err
	}
	decoder := json.NewDecoder(bytes.NewReader(encoded))
	decoder.UseNumber()
	var parsed any
	if err := decoder.Decode(&parsed); err != nil {
		return cleaned, err
	}
	rewritten, err := json.Marshal(r.tree(parsed))
	if err != nil {
		return cleaned, err
	}
	return cleaned, json.Unmarshal(rewritten, &cleaned)
}
