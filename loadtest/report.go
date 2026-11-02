package loadtest

import (
	"math"
	"time"
)

const (
	DistributionBins = 12
	millisecond      = float64(time.Millisecond)
)

type Latency struct {
	MinMs  float64 `json:"minMs"`
	MeanMs float64 `json:"meanMs"`
	P50Ms  float64 `json:"p50Ms"`
	P90Ms  float64 `json:"p90Ms"`
	P95Ms  float64 `json:"p95Ms"`
	P99Ms  float64 `json:"p99Ms"`
	MaxMs  float64 `json:"maxMs"`
}

type Bin struct {
	FromMs float64 `json:"fromMs"`
	ToMs   float64 `json:"toMs"`
	Count  int64   `json:"count"`
}

type Report struct {
	Config            Config        `json:"config"`
	Total             int64         `json:"total"`
	Succeeded         int64         `json:"succeeded"`
	Failed            int64         `json:"failed"`
	NetworkErrors     int64         `json:"networkErrors"`
	StatusFailures    int64         `json:"statusFailures"`
	StatusCodes       map[int]int64 `json:"statusCodes"`
	DurationMs        int64         `json:"durationMs"`
	RequestsPerSecond float64       `json:"requestsPerSecond"`
	Latency           Latency       `json:"latency"`
	BytesReceived     int64         `json:"bytesReceived"`
	ErrorSamples      []string      `json:"errorSamples"`
	Distribution      []Bin         `json:"distribution"`
	Stopped           bool          `json:"stopped"`
	Checks            []Check       `json:"checks,omitempty"`
}

type Snapshot struct {
	ElapsedMs         int64   `json:"elapsedMs"`
	Total             int64   `json:"total"`
	Failed            int64   `json:"failed"`
	RequestsPerSecond float64 `json:"requestsPerSecond"`
	P95Ms             float64 `json:"p95Ms"`
	ActiveWorkers     int     `json:"activeWorkers,omitempty"`
}

func toMs(duration time.Duration) float64 {
	return math.Round(float64(duration)/millisecond*1000) / 1000
}

func (r Report) ErrorRatePercent() float64 {
	if r.Total == 0 {
		return 0
	}
	return float64(r.Failed) / float64(r.Total) * 100
}

func (r Report) NothingSucceeded() bool {
	return r.Total > 0 && r.Succeeded == 0
}
