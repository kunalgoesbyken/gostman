package sandbox

import (
	"runtime"
	"sync"
	"time"

	"github.com/dop251/goja"
)

const (
	memoryAllowance = 512 << 20
	memoryInterval  = 50 * time.Millisecond
)

type watchdog struct {
	mutex    sync.Mutex
	released bool
	vm       *goja.Runtime
	timer    *time.Timer
	ticker   *time.Ticker
	done     chan struct{}
}

func heapInUse() uint64 {
	var stats runtime.MemStats
	runtime.ReadMemStats(&stats)
	return stats.HeapAlloc
}

func watch(vm *goja.Runtime, limit time.Duration) *watchdog {
	guard := &watchdog{vm: vm, ticker: time.NewTicker(memoryInterval), done: make(chan struct{})}
	guard.timer = time.AfterFunc(limit, func() { guard.interrupt(errExpired) })
	ceiling := heapInUse() + memoryAllowance
	go guard.audit(ceiling)
	return guard
}

func (w *watchdog) audit(ceiling uint64) {
	for {
		select {
		case <-w.done:
			return
		case <-w.ticker.C:
			if heapInUse() > ceiling {
				w.interrupt(errMemory)
				return
			}
		}
	}
}

func (w *watchdog) interrupt(reason error) {
	w.mutex.Lock()
	defer w.mutex.Unlock()
	if !w.released {
		w.vm.Interrupt(reason)
	}
}

func (w *watchdog) release() {
	w.mutex.Lock()
	defer w.mutex.Unlock()
	w.released = true
	w.timer.Stop()
	w.ticker.Stop()
	close(w.done)
	w.vm.ClearInterrupt()
}
