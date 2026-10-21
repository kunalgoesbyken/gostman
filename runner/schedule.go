package runner

import (
	"context"
	"maps"
	"sync"
	"sync/atomic"

	"github.com/krockxz/gostman/runner/sandbox"
)

type unit struct {
	iteration int
	indexes   []int
}

func planUnits(iterations, requests, parallel int) []unit {
	var units []unit
	if iterations == 1 && parallel > 1 {
		for index := 0; index < requests; index++ {
			units = append(units, unit{iteration: 0, indexes: []int{index}})
		}
		return units
	}
	for iteration := 0; iteration < iterations; iteration++ {
		indexes := make([]int, requests)
		for index := range indexes {
			indexes[index] = index
		}
		units = append(units, unit{iteration: iteration, indexes: indexes})
	}
	return units
}

func (s *session) spawn() (*session, error) {
	scripts, err := sandbox.New()
	if err != nil {
		return nil, err
	}
	return &session{scripts: scripts, policy: s.policy, variables: variables{}, common: s.common}, nil
}

func (s *session) crew(wanted int) []*session {
	crew := []*session{s}
	for len(crew) < wanted {
		worker, err := s.spawn()
		if err != nil {
			break
		}
		crew = append(crew, worker)
	}
	return crew
}

type schedule struct {
	planned plan
	options Options
	units   []unit
	base    variables
	count   int
	slots   []Result
	filled  []bool
	halted  atomic.Bool
	emit    sync.Mutex
	observe func(Result)
}

func (c *schedule) record(slot int, result Result) {
	c.slots[slot] = result
	c.filled[slot] = true
	c.emit.Lock()
	defer c.emit.Unlock()
	c.observe(result)
}

func (c *schedule) work(ctx context.Context, worker *session, queue <-chan int) {
	total := len(c.planned.requests)
	for position := range queue {
		if c.halted.Load() || ctx.Err() != nil {
			continue
		}
		current := c.units[position]
		worker.variables = startingFor(c.base, c.options, current.iteration, c.count)
		for step, index := range current.indexes {
			request := c.planned.requests[index]
			result := worker.attempt(ctx, request, c.planned.folderNames[request.FolderID], c.options.Capture)
			if c.options.isIterating() {
				result.Iteration = current.iteration + 1
			}
			c.record(current.iteration*total+index, result)
			if ctx.Err() != nil {
				return
			}
			if c.options.Bail && result.Failed {
				c.halted.Store(true)
				break
			}
			isLast := step == len(current.indexes)-1 && position == len(c.units)-1
			if !isLast {
				pause(ctx, c.options.Delay)
			}
			if ctx.Err() != nil || c.halted.Load() {
				break
			}
		}
	}
}

func (s *session) runAll(ctx context.Context, planned plan, options Options, observe func(Result)) []Result {
	count := options.iterationCount()
	total := len(planned.requests)
	run := &schedule{
		planned: planned,
		options: options,
		units:   planUnits(count, total, options.Parallel),
		base:    maps.Clone(s.variables),
		count:   count,
		slots:   make([]Result, count*total),
		filled:  make([]bool, count*total),
		observe: observe,
	}
	queue := make(chan int, len(run.units))
	for position := range run.units {
		queue <- position
	}
	close(queue)

	crew := s.crew(min(max(options.Parallel, 1), max(len(run.units), 1)))
	var group sync.WaitGroup
	for _, worker := range crew {
		group.Add(1)
		go func() {
			defer group.Done()
			run.work(ctx, worker, queue)
		}()
	}
	group.Wait()

	results := make([]Result, 0, len(run.slots))
	for slot, result := range run.slots {
		if run.filled[slot] {
			results = append(results, result)
		}
	}
	return results
}
