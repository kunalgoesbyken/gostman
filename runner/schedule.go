package runner

import (
	"context"
	"maps"
	"sync"
	"sync/atomic"

	"github.com/kunalgoesbyken/gostman/runner/sandbox"
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
	return &session{scripts: scripts, policy: s.policy, variables: variables{}, session: variables{}, environment: s.environment, common: s.common, library: s.library, hosts: s.hosts, modules: s.modules, contract: s.contract}, nil
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
	session variables
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
		worker.session = maps.Clone(c.session)
		jumps := 0
		progress := newProgress(len(current.indexes))
		for cursor := 0; cursor < len(current.indexes); {
			request := c.planned.requests[current.indexes[cursor]]
			result := worker.attempt(ctx, request, c.planned.folderNames[request.FolderID], c.options.Capture)
			worker.common.publish(worker.current().plain())
			result.Iteration = c.iterationNumber(current)
			following, problem := c.follow(current, cursor, result.flow, &jumps, limit)
			reason := result.flow.passedOver(request.Name)
			if problem != "" {
				result.flag(problem)
				reason = ""
			}
			progress.note(cursor, following, reason)
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
		c.recordPassedOver(position, current, progress)
	}
}

type unitProgress struct {
	attempted []bool
	passed    []string
}

func newProgress(size int) unitProgress {
	return unitProgress{attempted: make([]bool, size), passed: make([]string, size)}
}

func (p unitProgress) note(cursor, following int, reason string) {
	p.attempted[cursor] = true
	if reason == "" {
		return
	}
	for skipped := cursor + 1; skipped < min(following, len(p.passed)); skipped++ {
		if p.passed[skipped] == "" {
			p.passed[skipped] = reason
		}
	}
}

func (c *schedule) iterationNumber(current unit) int {
	if c.options.isIterating() {
		return current.iteration + 1
	}
	return 0
}

func (c *schedule) recordPassedOver(position int, current unit, progress unitProgress) {
	for cursor, index := range current.indexes {
		if progress.attempted[cursor] || progress.passed[cursor] == "" {
			continue
		}
		request := c.planned.requests[index]
		result := identify(request, c.planned.folderNames[request.FolderID])
		result.Skipped = progress.passed[cursor]
		result.Iteration = c.iterationNumber(current)
		c.record(position, result)
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
		session: maps.Clone(s.session),
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
