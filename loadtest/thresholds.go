package loadtest

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

type Check struct {
	Expression string  `json:"expression"`
	Metric     string  `json:"metric"`
	Observed   float64 `json:"observed"`
	Limit      float64 `json:"limit"`
	Unit       string  `json:"unit"`
	Passed     bool    `json:"passed"`
}

type threshold struct {
	expression string
	metric     string
	operator   string
	limit      float64
	unit       string
}

const (
	unitMs      = "ms"
	unitPercent = "%"
	unitRate    = "req/s"
	unitCount   = ""
)

var operators = []string{"<=", ">=", "<", ">"}

var latencyMetrics = map[string]func(Latency) float64{
	"min":  func(l Latency) float64 { return l.MinMs },
	"avg":  func(l Latency) float64 { return l.MeanMs },
	"mean": func(l Latency) float64 { return l.MeanMs },
	"med":  func(l Latency) float64 { return l.P50Ms },
	"p50":  func(l Latency) float64 { return l.P50Ms },
	"p90":  func(l Latency) float64 { return l.P90Ms },
	"p95":  func(l Latency) float64 { return l.P95Ms },
	"p99":  func(l Latency) float64 { return l.P99Ms },
	"max":  func(l Latency) float64 { return l.MaxMs },
}

func parseThreshold(expression string) (threshold, error) {
	text := strings.TrimSpace(expression)
	for _, operator := range operators {
		name, value, found := strings.Cut(text, operator)
		if !found {
			continue
		}
		return buildThreshold(text, strings.ToLower(strings.TrimSpace(name)), operator, strings.TrimSpace(value))
	}
	return threshold{}, fmt.Errorf("threshold %q needs a comparison, for example p95<300 or errors<1%%", expression)
}

func buildThreshold(expression, metric, operator, value string) (threshold, error) {
	parsed := threshold{expression: expression, metric: metric, operator: operator}
	var err error
	switch {
	case latencyMetrics[metric] != nil:
		parsed.unit = unitMs
		parsed.limit, err = parseDurationMs(value)
	case metric == "errors" || metric == "error_rate":
		parsed.metric, parsed.unit = "errors", unitPercent
		parsed.limit, err = parsePercent(value)
	case metric == "rps" || metric == "throughput":
		parsed.metric, parsed.unit = "rps", unitRate
		parsed.limit, err = strconv.ParseFloat(value, 64)
	case metric == "failed":
		parsed.unit = unitCount
		parsed.limit, err = strconv.ParseFloat(value, 64)
	default:
		return threshold{}, fmt.Errorf("threshold %q: unknown metric %q; use min, avg, med, p50, p90, p95, p99, max, errors, failed or rps", expression, metric)
	}
	if err != nil {
		return threshold{}, fmt.Errorf("threshold %q: %w", expression, err)
	}
	return parsed, nil
}

func parseDurationMs(value string) (float64, error) {
	unitless, err := strconv.ParseFloat(value, 64)
	if err == nil {
		return unitless, nil
	}
	duration, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("%q is not a time such as 300, 300ms or 1.5s", value)
	}
	return toMs(duration), nil
}

func parsePercent(value string) (float64, error) {
	rate, err := strconv.ParseFloat(strings.TrimSpace(strings.TrimSuffix(value, "%")), 64)
	if err != nil || rate < 0 || rate > 100 {
		return 0, fmt.Errorf("%q is not a percentage between 0 and 100", value)
	}
	return rate, nil
}

func ValidateThresholds(expressions []string) error {
	for _, expression := range expressions {
		if _, err := parseThreshold(expression); err != nil {
			return err
		}
	}
	return nil
}

func (t threshold) observed(report Report) float64 {
	switch t.metric {
	case "errors":
		return report.ErrorRatePercent()
	case "rps":
		return report.RequestsPerSecond
	case "failed":
		return float64(report.Failed)
	}
	return latencyMetrics[t.metric](report.Latency)
}

func (t threshold) holds(observed float64) bool {
	switch t.operator {
	case "<":
		return observed < t.limit
	case "<=":
		return observed <= t.limit
	case ">":
		return observed > t.limit
	}
	return observed >= t.limit
}

func EvaluateThresholds(expressions []string, report Report) []Check {
	var checks []Check
	for _, expression := range expressions {
		parsed, err := parseThreshold(expression)
		if err != nil {
			continue
		}
		observed := parsed.observed(report)
		if report.Total == 0 {
			checks = append(checks, Check{Expression: parsed.expression, Metric: parsed.metric, Limit: parsed.limit, Unit: parsed.unit})
			continue
		}
		checks = append(checks, Check{
			Expression: parsed.expression,
			Metric:     parsed.metric,
			Observed:   roundTo(observed, 1000),
			Limit:      parsed.limit,
			Unit:       parsed.unit,
			Passed:     parsed.holds(observed),
		})
	}
	return checks
}

func roundTo(value, scale float64) float64 {
	return float64(int64(value*scale+0.5)) / scale
}

func (c Check) Describe() string {
	return fmt.Sprintf("%s (observed %s)", c.Expression, formatMeasure(c.Observed, c.Unit))
}

func formatMeasure(value float64, unit string) string {
	text := strconv.FormatFloat(value, 'f', -1, 64)
	switch unit {
	case unitPercent:
		return text + "%"
	case unitCount:
		return text
	}
	return text + " " + unit
}

func FailedChecks(checks []Check) []Check {
	var failed []Check
	for _, check := range checks {
		if !check.Passed {
			failed = append(failed, check)
		}
	}
	return failed
}
