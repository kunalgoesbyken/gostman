package sandbox

import (
	"math"
	"time"

	"github.com/dop251/goja"
)

const shortestInterval = time.Millisecond

type timer struct {
	id        int64
	due       time.Time
	interval  time.Duration
	repeats   bool
	callback  goja.Callable
	arguments []goja.Value
}

type timers struct {
	sequence int64
	pending  []*timer
}

func (t *timers) install(vm *goja.Runtime) {
	vm.Set("setTimeout", t.scheduler(vm, false))
	vm.Set("setInterval", t.scheduler(vm, true))
	vm.Set("clearTimeout", t.cancel)
	vm.Set("clearInterval", t.cancel)
}

func delayOf(value goja.Value) time.Duration {
	milliseconds := min(max(value.ToInteger(), 0), math.MaxInt32)
	return time.Duration(milliseconds) * time.Millisecond
}

func (t *timers) scheduler(vm *goja.Runtime, repeats bool) func(goja.FunctionCall) goja.Value {
	return func(call goja.FunctionCall) goja.Value {
		callback, ok := goja.AssertFunction(call.Argument(0))
		if !ok {
			return goja.Undefined()
		}
		delay := delayOf(call.Argument(1))
		t.sequence++
		scheduled := &timer{id: t.sequence, due: time.Now().Add(delay), interval: delay, repeats: repeats, callback: callback}
		if len(call.Arguments) > 2 {
			scheduled.arguments = call.Arguments[2:]
		}
		t.pending = append(t.pending, scheduled)
		return vm.ToValue(scheduled.id)
	}
}

func (t *timers) cancel(call goja.FunctionCall) goja.Value {
	t.remove(call.Argument(0).ToInteger())
	return goja.Undefined()
}

func (t *timers) remove(id int64) {
	for index, candidate := range t.pending {
		if candidate.id == id {
			t.pending = append(t.pending[:index], t.pending[index+1:]...)
			return
		}
	}
}

func (t *timers) earliest() *timer {
	var first *timer
	for _, candidate := range t.pending {
		if first == nil || candidate.due.Before(first.due) {
			first = candidate
		}
	}
	return first
}

func (t *timers) runNext(deadline time.Time) error {
	next := t.earliest()
	if next == nil {
		return errStalled
	}
	if next.due.After(deadline) || time.Now().After(deadline) {
		time.Sleep(time.Until(deadline))
		return errExpired
	}
	time.Sleep(time.Until(next.due))
	if next.repeats {
		next.due = time.Now().Add(max(next.interval, shortestInterval))
	} else {
		t.remove(next.id)
	}
	_, err := next.callback(goja.Undefined(), next.arguments...)
	return err
}
