package capture

import (
	"context"
	"net/http"
	"sync"
	"time"
)

type recordingKey struct{}

type recording struct {
	exchange Exchange
	host     string
	asked    http.Header
	answer   http.Header
	sent     keptBody
	received keptBody
	deliver  func(Exchange)
	once     sync.Once
}

func newRecording(r *http.Request, deliver func(Exchange)) *recording {
	return &recording{
		exchange: Exchange{Time: time.Now(), Method: r.Method, Path: r.URL.RequestURI()},
		host:     r.Host,
		asked:    r.Header.Clone(),
		deliver:  deliver,
	}
}

func (r *recording) attach(ctx context.Context) context.Context {
	return context.WithValue(ctx, recordingKey{}, r)
}

func recordingOf(ctx context.Context) *recording {
	return ctx.Value(recordingKey{}).(*recording)
}

func (r *recording) answered(response *http.Response) {
	r.exchange.Status = response.StatusCode
	r.answer = response.Header.Clone()
	if response.StatusCode == http.StatusSwitchingProtocols {
		r.exchange.Upgraded = true
		r.finish()
		return
	}
	response.Body = observedBody{response.Body, &r.received}
}

func (r *recording) failed(status int, reason string) {
	r.exchange.Status = status
	r.exchange.Error = reason
}

func (r *recording) isInterrupted() bool {
	return r.answer != nil && !r.exchange.Upgraded && !r.received.isFinished()
}

func (r *recording) finish() {
	r.once.Do(func() {
		exchange := r.exchange
		exchange.DurationMs = time.Since(exchange.Time).Milliseconds()
		exchange.Request = r.sent.message(r.asked)
		exchange.Response = r.received.message(r.answer)
		exchange.Interrupted = r.isInterrupted()
		if r.deliver != nil {
			r.deliver(exchange)
		}
	})
}
