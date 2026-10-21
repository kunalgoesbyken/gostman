package loadtest

import (
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
)

type sample struct {
	latency time.Duration
	outcome engine.Response
}

type collector struct {
	mu             sync.Mutex
	failureStatus  int
	latencies      *latencyHistogram
	statusCodes    map[int]int64
	networkErrors  int64
	statusFailures int64
	bytes          int64
	messages       []string
	seen           map[string]bool
}

func newCollector(failureStatus int) *collector {
	return &collector{
		failureStatus: failureStatus,
		latencies:     newLatencyHistogram(),
		statusCodes:   map[int]int64{},
		seen:          map[string]bool{},
	}
}

func (c *collector) record(measured sample) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.latencies.record(measured.latency)
	response := measured.outcome
	if response.Error != "" {
		c.networkErrors++
		c.keepMessage(fmt.Sprintf("%s: %s", response.Error, response.Body))
		return
	}
	c.statusCodes[response.StatusCode]++
	c.bytes += response.Size
	if response.StatusCode >= c.failureStatus {
		c.statusFailures++
		c.keepMessage(fmt.Sprintf("HTTP %s", response.Status))
	}
}

func (c *collector) keepMessage(message string) {
	if c.seen[message] || len(c.messages) >= MaxErrorSamples {
		return
	}
	c.seen[message] = true
	c.messages = append(c.messages, message)
}

func (c *collector) snapshot() (total, failed int64, p95 time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.latencies.total, c.networkErrors + c.statusFailures, c.latencies.quantile(0.95)
}

func (c *collector) report(config Config, elapsed time.Duration, stopped bool) Report {
	c.mu.Lock()
	defer c.mu.Unlock()
	total := c.latencies.total
	failed := c.networkErrors + c.statusFailures
	report := Report{
		Config:         config,
		Total:          total,
		Succeeded:      total - failed,
		Failed:         failed,
		NetworkErrors:  c.networkErrors,
		StatusFailures: c.statusFailures,
		StatusCodes:    c.statusCodes,
		DurationMs:     elapsed.Milliseconds(),
		BytesReceived:  c.bytes,
		ErrorSamples:   append([]string{}, c.messages...),
		Distribution:   c.latencies.bins(DistributionBins),
		Stopped:        stopped,
		Latency: Latency{
			MinMs:  toMs(c.latencies.lowest),
			MeanMs: toMs(c.latencies.mean()),
			P50Ms:  toMs(c.latencies.quantile(0.50)),
			P90Ms:  toMs(c.latencies.quantile(0.90)),
			P95Ms:  toMs(c.latencies.quantile(0.95)),
			P99Ms:  toMs(c.latencies.quantile(0.99)),
			MaxMs:  toMs(c.latencies.most),
		},
	}
	if elapsed > 0 {
		report.RequestsPerSecond = math.Round(float64(total)/elapsed.Seconds()*100) / 100
	}
	return report
}
