package loadtest

import (
	"math"
	"time"
)

const (
	LatencyRelativeAccuracyPercent = 1
	LongestTrackedLatency          = time.Hour

	latencyGrowth = 1 + LatencyRelativeAccuracyPercent/100.0
	shortestTick  = time.Microsecond
)

var growthLog = math.Log(latencyGrowth)

type latencyHistogram struct {
	counts []int64
	total  int64
	sum    time.Duration
	lowest time.Duration
	most   time.Duration
}

func bucketOf(latency time.Duration) int {
	ticks := max(latency, shortestTick) / shortestTick
	return int(math.Ceil(math.Log(float64(ticks)) / growthLog))
}

func upperBound(bucket int) time.Duration {
	return time.Duration(math.Pow(latencyGrowth, float64(bucket)) * float64(shortestTick))
}

func newLatencyHistogram() *latencyHistogram {
	return &latencyHistogram{counts: make([]int64, bucketOf(LongestTrackedLatency)+1)}
}

func (h *latencyHistogram) record(latency time.Duration) {
	bucket := min(bucketOf(latency), len(h.counts)-1)
	h.counts[bucket]++
	h.total++
	h.sum += latency
	if h.total == 1 || latency < h.lowest {
		h.lowest = latency
	}
	h.most = max(h.most, latency)
}

func (h *latencyHistogram) clamp(value time.Duration) time.Duration {
	return min(max(value, h.lowest), h.most)
}

func (h *latencyHistogram) quantile(fraction float64) time.Duration {
	if h.total == 0 {
		return 0
	}
	rank := max(int64(math.Ceil(fraction*float64(h.total))), 1)
	var seen int64
	for bucket, count := range h.counts {
		seen += count
		if seen >= rank {
			return h.clamp(upperBound(bucket))
		}
	}
	return h.most
}

func (h *latencyHistogram) mean() time.Duration {
	if h.total == 0 {
		return 0
	}
	return h.sum / time.Duration(h.total)
}

func (h *latencyHistogram) bins(count int) []Bin {
	if h.total == 0 {
		return []Bin{}
	}
	edge := max(h.quantile(0.99), h.lowest+1)
	width := (edge - h.lowest + time.Duration(count) - 1) / time.Duration(count)
	bins := make([]Bin, count)
	for index := range bins {
		bins[index].FromMs = toMs(h.lowest + width*time.Duration(index))
		bins[index].ToMs = toMs(h.lowest + width*time.Duration(index+1))
	}
	for bucket, hits := range h.counts {
		if hits == 0 {
			continue
		}
		position := int((h.clamp(upperBound(bucket)) - h.lowest) / width)
		bins[min(position, count-1)].Count += hits
	}
	return bins
}
