package engine

import (
	"sync"
	"time"
)

const (
	batchInterval = 50 * time.Millisecond
	batchLimit    = 256
)

type batcher struct {
	mu      sync.Mutex
	pending []StreamMessage
	timer   *time.Timer
	emit    func([]StreamMessage)
}

func (b *batcher) add(message StreamMessage) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.pending = append(b.pending, message)
	if len(b.pending) >= batchLimit {
		b.flushLocked()
		return
	}
	if b.timer == nil {
		b.timer = time.AfterFunc(batchInterval, b.flush)
	}
}

func (b *batcher) flush() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.flushLocked()
}

func (b *batcher) flushLocked() {
	if b.timer != nil {
		b.timer.Stop()
		b.timer = nil
	}
	if len(b.pending) == 0 {
		return
	}
	batch := b.pending
	b.pending = nil
	b.emit(batch)
}
