package main

import (
	"flag"
	"fmt"
	"io"
	"os"
	"slices"
	"text/tabwriter"
	"time"

	"github.com/kunalgoesbyken/gostman/monitor"
)

const recentRuns = 10

type historyReport struct {
	Directory string           `json:"directory"`
	Trend     monitor.Trend    `json:"trend"`
	Runs      []monitor.Record `json:"runs"`
}

func historyCommand(arguments []string, stdout, stderr *os.File) int {
	flags := flag.NewFlagSet("history", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	target := flags.String("target", "", "")
	limit := flags.Int("limit", 0, "")
	asJSON := flags.Bool("json", false, "")
	positional, err := parseInterspersed(flags, arguments)
	switch {
	case err != nil:
		return misuse(stderr, err.Error())
	case len(positional) > 1:
		return misuse(stderr, "name at most one workspace folder or export file")
	case *limit < 0:
		return misuse(stderr, "--limit takes a number of runs, zero or more")
	}
	path := currentFolder
	if len(positional) == 1 {
		path = positional[0]
	}
	store, err := monitor.Open(path, monitor.DefaultKeep)
	if err != nil {
		return complain(stderr, err)
	}
	records, err := store.List(*limit)
	if err != nil {
		return complain(stderr, err)
	}
	records = monitor.Targeting(records, *target)
	report := historyReport{Directory: store.Dir, Trend: monitor.Summarize(records), Runs: records}
	if *asJSON {
		if err := writeJSON(stdout, report); err != nil {
			return complain(stderr, err)
		}
		return exitPassed
	}
	printHistory(stdout, report)
	return exitPassed
}

func verdictOf(record monitor.Record) string {
	if record.Passed {
		return "PASS"
	}
	return "FAIL"
}

func milliseconds(value int64) string {
	return (time.Duration(value) * time.Millisecond).String()
}

func printHistory(stdout io.Writer, report historyReport) {
	if len(report.Runs) == 0 {
		fmt.Fprintf(stdout, "No runs recorded yet. Run with --every or --record to start a history (%s).\n", report.Directory)
		return
	}
	trend := report.Trend
	fmt.Fprintf(stdout, "%d runs, %d passed, %d failed, pass rate %.1f%%\n", trend.Runs, trend.Passed, trend.Failed, trend.PassRate*100)
	fmt.Fprintf(stdout, "History in %s\n\nLatest runs, newest first:\n", report.Directory)
	table := tabwriter.NewWriter(stdout, 0, 0, 2, ' ', 0)
	latest := slices.Clone(report.Runs)
	slices.Reverse(latest)
	for _, record := range latest[:min(len(latest), recentRuns)] {
		fmt.Fprintf(table, "%s\t%s\t%s\t%d passed, %d failed\t%s\n",
			record.StartedAt.Local().Format(timeLayout), verdictOf(record), record.Target,
			record.Summary.Passed, record.Summary.Failed, milliseconds(record.DurationMs))
	}
	table.Flush()
	if len(trend.Requests) == 0 {
		return
	}
	fmt.Fprintln(stdout, "\nRequests (durations are of requests that got a response):")
	requests := tabwriter.NewWriter(stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(requests, "NAME\tRUNS\tFAILED\tP50\tP95")
	for _, request := range trend.Requests {
		fmt.Fprintf(requests, "%s\t%d\t%d\t%s\t%s\n", request.Name, request.Runs, request.Failed, milliseconds(request.P50Ms), milliseconds(request.P95Ms))
	}
	requests.Flush()
}
