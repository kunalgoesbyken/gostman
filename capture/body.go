package capture

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	bodyLimit             = 2 << 20
	headerContentType     = "Content-Type"
	headerContentEncoding = "Content-Encoding"
	encodingGzip          = "gzip"
)

type keptBody struct {
	mu       sync.Mutex
	bytes    []byte
	size     int64
	finished bool
}

type observedBody struct {
	io.ReadCloser
	kept *keptBody
}

func (o observedBody) Read(buffer []byte) (int, error) {
	count, err := o.ReadCloser.Read(buffer)
	o.kept.add(buffer[:count], err == io.EOF)
	return count, err
}

func (k *keptBody) add(chunk []byte, finished bool) {
	k.mu.Lock()
	defer k.mu.Unlock()
	k.size += int64(len(chunk))
	room := bodyLimit - len(k.bytes)
	k.bytes = append(k.bytes, chunk[:min(room, len(chunk))]...)
	k.finished = k.finished || finished
}

func (k *keptBody) isFinished() bool {
	k.mu.Lock()
	defer k.mu.Unlock()
	return k.finished
}

func isGzipped(header http.Header) bool {
	return strings.EqualFold(strings.TrimSpace(header.Get(headerContentEncoding)), encodingGzip)
}

func gunzip(compressed []byte) ([]byte, bool) {
	reader, err := gzip.NewReader(bytes.NewReader(compressed))
	if err != nil {
		return nil, false
	}
	decoded, err := io.ReadAll(io.LimitReader(reader, bodyLimit+1))
	if len(decoded) > bodyLimit {
		return decoded[:bodyLimit], false
	}
	return decoded, err == nil
}

func sortedHeaders(header http.Header) []engine.HeaderEntry {
	entries := append([]engine.HeaderEntry{}, engine.FlattenHeaders(header)...)
	sort.SliceStable(entries, func(first, second int) bool { return entries[first].Key < entries[second].Key })
	return entries
}

func (k *keptBody) message(header http.Header) Message {
	k.mu.Lock()
	defer k.mu.Unlock()
	body, truncated := k.bytes, k.size > int64(len(k.bytes))
	if len(body) > 0 && isGzipped(header) {
		decoded, complete := gunzip(body)
		body, truncated = decoded, truncated || !complete
	}
	text, encoding := engine.EncodeBody(body, truncated)
	return Message{
		Headers:      sortedHeaders(header),
		Body:         text,
		BodyEncoding: encoding,
		ContentType:  engine.MediaType(header.Get(headerContentType), body),
		Size:         k.size,
		Truncated:    truncated,
	}
}
