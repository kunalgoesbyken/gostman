package loadtest

import (
	"fmt"
	"io"
	"sort"
	"strings"
)

const OwnershipNotice = "Load tests must only target systems you own or have permission to test."

func WriteText(out io.Writer, report Report) error {
	lines := []string{
		fmt.Sprintf("requests      %d total, %d succeeded, %d failed (%d network, %d status >= %d)",
			report.Total, report.Succeeded, report.Failed, report.NetworkErrors, report.StatusFailures, report.Config.FailureStatus),
		fmt.Sprintf("duration      %.2f s%s", float64(report.DurationMs)/1000, stoppedNote(report)),
		fmt.Sprintf("throughput    %.2f requests/s", report.RequestsPerSecond),
		fmt.Sprintf("received      %d bytes", report.BytesReceived),
		fmt.Sprintf("latency (ms)  min %.2f  mean %.2f  p50 %.2f  p90 %.2f  p95 %.2f  p99 %.2f  max %.2f",
			report.Latency.MinMs, report.Latency.MeanMs, report.Latency.P50Ms, report.Latency.P90Ms,
			report.Latency.P95Ms, report.Latency.P99Ms, report.Latency.MaxMs),
		"status codes  " + statusLine(report.StatusCodes),
	}
	for _, sample := range report.ErrorSamples {
		lines = append(lines, "error sample  "+sample)
	}
	_, err := fmt.Fprintln(out, strings.Join(lines, "\n"))
	return err
}

func WriteProgress(out io.Writer, snapshot Snapshot) {
	fmt.Fprintf(out, "%6.1fs  %d requests  %.0f/s  p95 %.1f ms  %d failed\n",
		float64(snapshot.ElapsedMs)/1000, snapshot.Total, snapshot.RequestsPerSecond, snapshot.P95Ms, snapshot.Failed)
}

func stoppedNote(report Report) string {
	if report.Stopped {
		return " (stopped early)"
	}
	return ""
}

func statusLine(codes map[int]int64) string {
	if len(codes) == 0 {
		return "none"
	}
	ordered := make([]int, 0, len(codes))
	for code := range codes {
		ordered = append(ordered, code)
	}
	sort.Ints(ordered)
	parts := make([]string, 0, len(ordered))
	for _, code := range ordered {
		parts = append(parts, fmt.Sprintf("%d x%d", code, codes[code]))
	}
	return strings.Join(parts, "  ")
}
