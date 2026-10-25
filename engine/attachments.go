package engine

import (
	"bytes"
	"context"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"

	"github.com/kunalgoesbyken/gostman/locales"
)

const maxAttachedBytes = 1 << 30

var (
	errAttachmentsUnavailable = locales.Errorf(locales.EngineAttachmentsUnavailable, nil)
	errAttachmentsTooLarge    = locales.Errorf(locales.EngineAttachmentsTooLarge, locales.Params{"size": maxAttachedBytes >> 30})
	errSignedAttachment       = locales.Errorf(locales.EngineAttachmentsSigned, locales.Params{"size": maxRequestBody >> 20})
)

type FileOpener func(path string) (*os.File, error)

func LocalOpener() FileOpener {
	return openLocal
}

func refusingOpener(reason error) FileOpener {
	return func(string) (*os.File, error) {
		return nil, reason
	}
}

type segment struct {
	data []byte
	file *os.File
	size int64
}

type bodyStream struct {
	segments []segment
	open     FileOpener
	attached int64
}

func (b *bodyStream) Write(data []byte) (int, error) {
	last := len(b.segments) - 1
	if last < 0 || b.segments[last].file != nil {
		b.segments = append(b.segments, segment{})
		last++
	}
	b.segments[last].data = append(b.segments[last].data, data...)
	return len(data), nil
}

func (b *bodyStream) attach(name, path string) error {
	if b.open == nil {
		return nil
	}
	file, err := b.open(path)
	if err != nil {
		return locales.Wrap(locales.EngineAttachmentsFailed, locales.Params{"name": name}, err)
	}
	info, err := file.Stat()
	if err == nil && !info.Mode().IsRegular() {
		err = locales.Errorf(locales.EngineAttachmentsNotRegular, locales.Params{"path": path})
	}
	if err != nil {
		file.Close()
		return locales.Wrap(locales.EngineAttachmentsFailed, locales.Params{"name": name}, err)
	}
	b.attached += info.Size()
	b.segments = append(b.segments, segment{file: file, size: info.Size()})
	if b.attached > maxAttachedBytes {
		return errAttachmentsTooLarge
	}
	return nil
}

func (b *bodyStream) streamed() bool {
	for _, part := range b.segments {
		if part.file != nil {
			return true
		}
	}
	return false
}

func (b *bodyStream) bytes() []byte {
	var joined []byte
	for _, part := range b.segments {
		joined = append(joined, part.data...)
	}
	return joined
}

func (b *bodyStream) size() int64 {
	var total int64
	for _, part := range b.segments {
		total += int64(len(part.data)) + part.size
	}
	return total
}

func (b *bodyStream) reader() io.Reader {
	readers := make([]io.Reader, 0, len(b.segments))
	for _, part := range b.segments {
		if part.file != nil {
			readers = append(readers, io.NewSectionReader(part.file, 0, part.size))
		} else {
			readers = append(readers, bytes.NewReader(part.data))
		}
	}
	return io.MultiReader(readers...)
}

func (b *bodyStream) load() ([]byte, error) {
	if b.size() > maxRequestBody {
		return nil, errSignedAttachment
	}
	return io.ReadAll(b.reader())
}

func (b *bodyStream) close() {
	for _, part := range b.segments {
		if part.file != nil {
			part.file.Close()
		}
	}
}

func attachedType(contentType, path string) string {
	if contentType != "" {
		return contentType
	}
	if guessed := mime.TypeByExtension(filepath.Ext(path)); guessed != "" {
		return guessed
	}
	return contentTypeBinary
}

var bodySigners = map[string]bool{authAWSV4: true, authOAuth1: true, authEdgeGrid: true, authHawk: true}

func signsBody(auth Auth) bool {
	return bodySigners[auth.Type]
}

func (p Prepared) releaseWith(ctx context.Context) {
	if p.stream != nil {
		context.AfterFunc(ctx, p.stream.close)
	}
}

func (p Prepared) streamTo(outgoing *http.Request) {
	if p.stream == nil {
		return
	}
	stream := p.stream
	outgoing.ContentLength = stream.size()
	outgoing.GetBody = func() (io.ReadCloser, error) {
		return io.NopCloser(stream.reader()), nil
	}
	outgoing.Body = io.NopCloser(stream.reader())
}
