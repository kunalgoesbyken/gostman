package monitor

import (
	"math"
	"slices"
	"sort"
)

type RequestTrend struct {
	Name   string `json:"name"`
	Runs   int    `json:"runs"`
	Failed int    `json:"failed"`
	P50Ms  int64  `json:"p50Ms"`
	P95Ms  int64  `json:"p95Ms"`
}

type Trend struct {
	Runs     int            `json:"runs"`
	Passed   int            `json:"passed"`
	Failed   int            `json:"failed"`
	PassRate float64        `json:"passRate"`
	Requests []RequestTrend `json:"requests"`
}

func Percentile(sorted []int64, percent float64) int64 {
	if len(sorted) == 0 {
		return 0
	}
	rank := int(math.Ceil(percent / 100 * float64(len(sorted))))
	return sorted[min(max(rank, 1), len(sorted))-1]
}

func Targeting(records []Record, target string) []Record {
	if target == "" {
		return records
	}
	var kept []Record
	for _, record := range records {
		if record.Target == target {
			kept = append(kept, record)
		}
	}
	return kept
}

type tally struct {
	runs      int
	failed    int
	durations []int64
}

func Summarize(records []Record) Trend {
	trend := Trend{Runs: len(records), Requests: []RequestTrend{}}
	tallies := map[string]*tally{}
	for _, record := range records {
		if record.Passed {
			trend.Passed++
		}
		for _, entry := range record.Requests {
			if entry.Skipped {
				continue
			}
			seen := tallies[entry.Name]
			if seen == nil {
				seen = &tally{}
				tallies[entry.Name] = seen
			}
			seen.runs++
			if entry.Failed {
				seen.failed++
			}
			if entry.StatusCode > 0 {
				seen.durations = append(seen.durations, entry.DurationMs)
			}
		}
	}
	trend.Failed = trend.Runs - trend.Passed
	if trend.Runs > 0 {
		trend.PassRate = float64(trend.Passed) / float64(trend.Runs)
	}
	for name, seen := range tallies {
		slices.Sort(seen.durations)
		trend.Requests = append(trend.Requests, RequestTrend{
			Name:   name,
			Runs:   seen.runs,
			Failed: seen.failed,
			P50Ms:  Percentile(seen.durations, 50),
			P95Ms:  Percentile(seen.durations, 95),
		})
	}
	sort.Slice(trend.Requests, func(i, j int) bool { return trend.Requests[i].Name < trend.Requests[j].Name })
	return trend
}
