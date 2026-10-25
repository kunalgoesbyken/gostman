package sandbox

import (
	"runtime"
	"sync"
)

const mostSpares = 4

type booted struct {
	machine *machine
	err     error
}

type sparePool struct {
	start sync.Once
	ready chan booted
}

var spares = &sparePool{}

func spareCount() int {
	return min(max(runtime.GOMAXPROCS(0)/2, 1), mostSpares)
}

func (p *sparePool) take() (*machine, error) {
	p.start.Do(p.fill)
	next := <-p.ready
	go p.prepare()
	return next.machine, next.err
}

func (p *sparePool) fill() {
	p.ready = make(chan booted, spareCount())
	for range cap(p.ready) {
		go p.prepare()
	}
}

func (p *sparePool) prepare() {
	fresh, err := boot()
	p.ready <- booted{machine: fresh, err: err}
}
