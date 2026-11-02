package loadtest

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

const stagePoll = 50 * time.Millisecond

type Stage struct {
	Duration time.Duration
	Target   int
}

func ParseStages(text string) ([]Stage, error) {
	var stages []Stage
	for _, entry := range strings.Split(text, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		length, target, found := strings.Cut(entry, ":")
		if !found {
			return nil, fmt.Errorf("stage %q needs a duration and a target, for example 30s:20", entry)
		}
		duration, err := time.ParseDuration(strings.TrimSpace(length))
		if err != nil || duration <= 0 {
			return nil, fmt.Errorf("stage %q: %q is not a positive duration such as 30s", entry, length)
		}
		workers, err := strconv.Atoi(strings.TrimSpace(target))
		if err != nil || workers < 0 || workers > MaxConcurrency {
			return nil, fmt.Errorf("stage %q: the target must be between 0 and %d", entry, MaxConcurrency)
		}
		stages = append(stages, Stage{duration, workers})
	}
	return stages, nil
}

func (c Config) stages() []Stage {
	stages, _ := ParseStages(c.Stages)
	return stages
}

func stagesLength(stages []Stage) time.Duration {
	var total time.Duration
	for _, stage := range stages {
		total += stage.Duration
	}
	return total
}

func highestTarget(stages []Stage) int {
	highest := 0
	for _, stage := range stages {
		highest = max(highest, stage.Target)
	}
	return highest
}

func targetAt(stages []Stage, elapsed time.Duration) int {
	previous := 0.0
	for _, stage := range stages {
		if elapsed < stage.Duration {
			progress := float64(elapsed) / float64(stage.Duration)
			return int(math.Ceil(previous + (float64(stage.Target)-previous)*progress))
		}
		elapsed -= stage.Duration
		previous = float64(stage.Target)
	}
	return int(previous)
}

func (c Config) validateStages() error {
	if c.Stages == "" {
		return nil
	}
	stages, err := ParseStages(c.Stages)
	switch {
	case err != nil:
		return err
	case len(stages) == 0:
		return fmt.Errorf("stages needs at least one duration:target pair")
	case highestTarget(stages) < 1:
		return fmt.Errorf("stages needs a target of at least 1")
	case stagesLength(stages) > MaxDuration:
		return fmt.Errorf("stages add up to more than %s", MaxDuration)
	case c.RampMs != 0:
		return fmt.Errorf("stages replace the ramp; use one or the other")
	}
	return nil
}
