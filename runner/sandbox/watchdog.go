package sandbox

import (
	"sync"
	"time"

	"github.com/dop251/goja"
)

type watchdog struct {
	mutex    sync.Mutex
	released bool
	vm       *goja.Runtime
	timer    *time.Timer
}

func watch(vm *goja.Runtime, limit time.Duration) *watchdog {
	guard := &watchdog{vm: vm}
	guard.timer = time.AfterFunc(limit, guard.interrupt)
	return guard
}

func (w *watchdog) interrupt() {
	w.mutex.Lock()
	defer w.mutex.Unlock()
	if !w.released {
		w.vm.Interrupt(errExpired)
	}
}

func (w *watchdog) release() {
	w.mutex.Lock()
	defer w.mutex.Unlock()
	w.released = true
	w.timer.Stop()
	w.vm.ClearInterrupt()
}
