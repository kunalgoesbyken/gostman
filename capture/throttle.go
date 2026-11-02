package capture

import (
	"context"
	"io"
	"net/http"
	"time"

	"github.com/kunalgoesbyken/gostman/mock"
)

const (
	bytesPerKilobyte = 1024
	pacesPerSecond   = 10
)

type slowReader struct {
	io.ReadCloser
	ctx            context.Context
	bytesPerSecond int
}

func slowed(ctx context.Context, source io.ReadCloser, kbps int) io.ReadCloser {
	if kbps <= 0 {
		return source
	}
	return slowReader{ReadCloser: source, ctx: ctx, bytesPerSecond: kbps * bytesPerKilobyte}
}

func paceOf(bytesPerSecond int) int {
	return max(1, bytesPerSecond/pacesPerSecond)
}

func timeFor(count, bytesPerSecond int) time.Duration {
	return time.Duration(count) * time.Second / time.Duration(bytesPerSecond)
}

func (s slowReader) Read(buffer []byte) (int, error) {
	limit := min(len(buffer), paceOf(s.bytesPerSecond))
	count, err := s.ReadCloser.Read(buffer[:limit])
	if count > 0 && !mock.Pause(s.ctx, timeFor(count, s.bytesPerSecond)) {
		return count, s.ctx.Err()
	}
	return count, err
}

func writeSlowly(ctx context.Context, w http.ResponseWriter, body []byte, kbps int) {
	if kbps <= 0 {
		w.Write(body)
		return
	}
	bytesPerSecond := kbps * bytesPerKilobyte
	flusher := http.NewResponseController(w)
	pace := paceOf(bytesPerSecond)
	for start := 0; start < len(body); start += pace {
		end := min(start+pace, len(body))
		w.Write(body[start:end])
		flusher.Flush()
		if !mock.Pause(ctx, timeFor(end-start, bytesPerSecond)) {
			return
		}
	}
}
