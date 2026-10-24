package main

import (
	"context"
	"errors"
	"sync"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/loadtest"
	"github.com/kunalgoesbyken/gostman/redact"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const loadTestProgressEventName = "loadtest:progress"

var errLoadTestRunning = errors.New("a load test is already running")

var (
	loadTestMutex  sync.Mutex
	loadTestCancel context.CancelFunc
)

func beginLoadTest(cancel context.CancelFunc) error {
	loadTestMutex.Lock()
	defer loadTestMutex.Unlock()
	if loadTestCancel != nil {
		return errLoadTestRunning
	}
	loadTestCancel = cancel
	return nil
}

func endLoadTest() {
	loadTestMutex.Lock()
	defer loadTestMutex.Unlock()
	if loadTestCancel != nil {
		loadTestCancel()
		loadTestCancel = nil
	}
}

func (a *App) RunLoadTest(request engine.Request, config loadtest.Config) (loadtest.Report, error) {
	ctx, cancel := context.WithCancel(a.ctx)
	if err := beginLoadTest(cancel); err != nil {
		cancel()
		return loadtest.Report{}, err
	}
	defer endLoadTest()

	report, err := loadtest.Run(ctx, loadtest.Plan{Config: config, Request: request, Policy: a.sendPolicy()}, a.emitLoadTestProgress)
	if err != nil {
		return loadtest.Report{}, errors.New(loadtest.Guard(request).Text(err.Error()))
	}
	return redact.Clean(loadtest.Guard(request), report)
}

func (a *App) StopLoadTest() {
	loadTestMutex.Lock()
	defer loadTestMutex.Unlock()
	if loadTestCancel != nil {
		loadTestCancel()
	}
}

func (a *App) emitLoadTestProgress(snapshot loadtest.Snapshot) {
	wailsruntime.EventsEmit(a.ctx, loadTestProgressEventName, snapshot)
}
