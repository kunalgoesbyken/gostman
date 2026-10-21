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
	return &session{scripts: scripts, policy: s.policy, variables: variables{}, common: s.common, library: s.library, hosts: s.hosts, modules: s.modules}, nil
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
	outputs [][]Result
	halted  atomic.Bool
	emit    sync.Mutex
	observe func(Result)
}

func (c *schedule) record(position int, result Result) {
	c.outputs[position] = append(c.outputs[position], result)
	c.emit.Lock()
	defer c.emit.Unlock()
	c.observe(result)
}

func (c *schedule) work(ctx context.Context, worker *session, queue <-chan int) {
	limit := worker.scripts.Limits().FlowSteps
	for position := range queue {
		if c.halted.Load() || ctx.Err() != nil {
			continue
		}
		current := c.units[position]
		worker.variables = startingFor(c.base, c.options, current.iteration, c.count)
		jumps := 0
		for cursor := 0; cursor < len(current.indexes); {
			request := c.planned.requests[current.indexes[cursor]]
			result := worker.attempt(ctx, request, c.planned.folderNames[request.FolderID], c.options.Capture)
			worker.common.publish(worker.variables.plain())
			if c.options.isIterating() {
				result.Iteration = current.iteration + 1
			}
			following, problem := c.follow(current, cursor, result.flow, &jumps, limit)
			if problem != "" {
				result.flag(problem)
			}
			c.record(position, result)
			if ctx.Err() != nil {
				return
			}
			if c.options.Bail && result.Failed {
				c.halted.Store(true)
				break
			}
			isLast := following >= len(current.indexes) && position == len(c.units)-1
			cursor = following
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
	units := planUnits(count, len(planned.requests), options.Parallel)
	run := &schedule{
		planned: planned,
		options: options,
		units:   units,
		base:    maps.Clone(s.variables),
		count:   count,
		outputs: make([][]Result, len(units)),
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

	var results []Result
	for _, output := range run.outputs {
		results = append(results, output...)
	}
	return results
}
