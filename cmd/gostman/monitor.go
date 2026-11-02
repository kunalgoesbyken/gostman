package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/monitor"
	"github.com/kunalgoesbyken/gostman/runner"
)

const (
	minimumEvery = time.Second
	timeLayout   = "2006-01-02 15:04:05"
)

type monitorFlags struct {
	every      time.Duration
	times      int
	untilFail  bool
	record     bool
	noRecord   bool
	keep       int
	notify     string
	notifyEnv  string
	notifyOn   string
	notifyHook string
}

func (m *monitorFlags) register(flags *flag.FlagSet) {
	flags.DurationVar(&m.every, "every", 0, "")
	flags.IntVar(&m.times, "times", 0, "")
	flags.BoolVar(&m.untilFail, "until-fail", false, "")
	flags.BoolVar(&m.record, "record", false, "")
	flags.BoolVar(&m.noRecord, "no-record", false, "")
	flags.IntVar(&m.keep, "keep", monitor.DefaultKeep, "")
	flags.StringVar(&m.notify, "notify", "", "")
	flags.StringVar(&m.notifyEnv, "notify-env", "", "")
	flags.StringVar(&m.notifyOn, "notify-on", monitor.NotifyOnFail, "")
}

func (m monitorFlags) repeating() bool {
	return m.every > 0
}

func (m monitorFlags) keepsText() bool {
	return m.recording() || m.notifyHook != ""
}

func (m monitorFlags) recording() bool {
	return m.record || (m.repeating() && !m.noRecord)
}

func (m *monitorFlags) validate() error {
	switch {
	case m.every < 0 || (m.every > 0 && m.every < minimumEvery):
		return errors.New("--every takes a duration of one second or more, for example 30s, 5m or 1h")
	case m.times < 0:
		return errors.New("--times takes a number of runs, one or more")
	case (m.times > 0 || m.untilFail) && !m.repeating():
		return errors.New("--times and --until-fail apply to --every")
	case m.record && m.noRecord:
		return errors.New("--record and --no-record cannot be combined")
	case m.keep < 1:
		return errors.New("--keep takes a number of runs to keep, one or more")
	case m.notify != "" && m.notifyEnv != "":
		return errors.New("give the notification address with --notify or --notify-env, not both")
	case m.notifyOn != monitor.NotifyOnFail && m.notifyOn != monitor.NotifyOnAlways:
		return errors.New("--notify-on takes fail or always")
	}
	return m.resolveNotify()
}

func (m *monitorFlags) resolveNotify() error {
	m.notifyHook = m.notify
	if m.notifyEnv != "" {
		m.notifyHook = os.Getenv(m.notifyEnv)
		if m.notifyHook == "" {
			return fmt.Errorf("the environment variable %s named by --notify-env is not set", m.notifyEnv)
		}
	}
	if m.notifyHook == "" {
		return nil
	}
	return monitor.Notifier{Address: m.notifyHook}.Validate()
}

func (i invocation) notifier() (monitor.Notifier, bool) {
	if i.monitor.notifyHook == "" {
		return monitor.Notifier{}, false
	}
	return monitor.Notifier{Address: i.monitor.notifyHook, Transport: engine.Policy{Network: i.options.Network}.Transport(false)}, true
}

func worse(current, next int) int {
	switch {
	case current == exitUnsent || next == exitUnsent:
		return exitUnsent
	case current == exitFailed || next == exitFailed:
		return exitFailed
	}
	return exitPassed
}

func (i invocation) targetOf(outcome runner.Report) (string, string) {
	if outcome.Flow != nil {
		return monitor.KindFlow, outcome.Flow.Name
	}
	if i.options.Folder != "" {
		return monitor.KindRun, i.options.Folder
	}
	return monitor.KindRun, collectionName(i.path)
}

func collectionName(path string) string {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return path
	}
	base := filepath.Base(absolute)
	return strings.TrimSuffix(base, filepath.Ext(base))
}

func (i invocation) record(outcome runner.Report, code int, scrub func(string) string, stderr *os.File) monitor.Record {
	kind, target := i.targetOf(outcome)
	record := monitor.Source{Kind: kind, Target: target, ExitCode: code, Scrub: scrub}.Record(outcome)
	if !i.monitor.recording() {
		return record
	}
	store, err := monitor.Open(i.path, i.monitor.keep)
	if err == nil {
		err = store.Save(record)
	}
	if err != nil {
		fmt.Fprintf(stderr, "warning: the run was not saved to the history: %s\n", err)
	}
	return record
}

func (i invocation) announce(ctx context.Context, record monitor.Record, previousFailed bool, stderr *os.File) {
	notifier, ok := i.notifier()
	if !ok {
		return
	}
	event := monitor.Event(record.Passed, previousFailed)
	wanted := i.monitor.notifyOn == monitor.NotifyOnAlways || event != monitor.EventPassed
	if !wanted || (event == monitor.EventFailed && previousFailed && i.monitor.notifyOn == monitor.NotifyOnFail) {
		return
	}
	if err := notifier.Post(ctx, monitor.NoticeFor(record, event)); err != nil {
		fmt.Fprintf(stderr, "warning: %s\n", err)
	}
}

func (i invocation) summaryLine(number int, record monitor.Record) string {
	verdict := "PASS"
	if !record.Passed {
		verdict = "FAIL"
	}
	target := record.Target
	if target == "" {
		target = "run"
	}
	return fmt.Sprintf("%s  #%d  %s  %s: %d passed, %d failed, %d of %d checks failed, %s",
		record.StartedAt.Local().Format(timeLayout), number, verdict, target,
		record.Summary.Passed, record.Summary.Failed, record.Summary.FailedTests, record.Summary.Tests,
		(time.Duration(record.DurationMs) * time.Millisecond).Round(time.Millisecond))
}

func pause(ctx context.Context, wait time.Duration) bool {
	if wait <= 0 {
		return ctx.Err() == nil
	}
	timer := time.NewTimer(wait)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

func (i invocation) monitored(ctx context.Context, stored runner.Collection, warned map[string]bool, stdout, stderr *os.File) int {
	worst := exitPassed
	previousFailed := false
	for number := 1; ; number++ {
		started := time.Now()
		if number > 1 {
			if reloaded, err := runner.Load(i.path); err == nil {
				stored = reloaded
			} else {
				fmt.Fprintf(stderr, "warning: the collection was not reloaded, the previous copy is used: %s\n", err)
			}
		}
		outcome, scrub, err := i.cycle(ctx, stored, warned, stdout, stderr)
		if ctx.Err() != nil {
			break
		}
		code := exitUnsent
		if err != nil {
			if number == 1 {
				return complain(stderr, err)
			}
			fmt.Fprintf(stderr, "%s: %s\n", programName, err)
		} else {
			code = i.codeOf(outcome, stderr)
			record := i.record(outcome, code, scrub, stderr)
			fmt.Fprintln(stdout, i.summaryLine(number, record))
			i.announce(ctx, record, previousFailed, stderr)
			previousFailed = !record.Passed
		}
		worst = worse(worst, code)
		if (i.monitor.untilFail && code != exitPassed) || (i.monitor.times > 0 && number >= i.monitor.times) {
			break
		}
		if !pause(ctx, i.monitor.every-time.Since(started)) {
			break
		}
	}
	return worst
}
