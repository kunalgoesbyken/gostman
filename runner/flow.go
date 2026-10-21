package runner

import "fmt"

const (
	flowNext = "next"
	flowSkip = "skip"
	flowStop = "stop"

	skippedByScript = "Skipped by a script."
	stoppedByScript = "Not sent because a script stopped the run."
)

type flow struct {
	Action string `json:"action"`
	Target string `json:"target"`
}

func (f flow) holdsBack() bool {
	return f.Action == flowSkip || f.Action == flowStop
}

func (f flow) reason() string {
	if f.Action == flowStop {
		return stoppedByScript
	}
	return skippedByScript
}

func (r *Result) flag(message string) {
	if r.Error != "" {
		r.Error += "\n"
	}
	r.Error += message
	r.Failed = true
}

func (c *schedule) locate(current unit, target string) (int, error) {
	selector := Options{Only: []string{target}}
	for cursor, index := range current.indexes {
		request := c.planned.requests[index]
		if selector.selects(request, c.planned.folderNames[request.FolderID]) {
			return cursor, nil
		}
	}
	for _, request := range c.planned.requests {
		if selector.selects(request, c.planned.folderNames[request.FolderID]) {
			return 0, fmt.Errorf("The script asked to continue with %q, but requests run in parallel so the order cannot be changed.", target)
		}
	}
	return 0, fmt.Errorf("The script asked to continue with %q, but no request in this run has that name.", target)
}

func (c *schedule) follow(current unit, cursor int, outcome flow, jumps *int, limit int) (int, string) {
	switch outcome.Action {
	case flowStop:
		c.halted.Store(true)
		return len(current.indexes), ""
	case flowNext:
		*jumps++
		if *jumps > limit {
			c.halted.Store(true)
			return len(current.indexes), fmt.Sprintf("The script redirected the run more than %d times, so the run was stopped.", limit)
		}
		target, err := c.locate(current, outcome.Target)
		if err != nil {
			c.halted.Store(true)
			return len(current.indexes), err.Error()
		}
		return target, ""
	}
	return cursor + 1, ""
}
