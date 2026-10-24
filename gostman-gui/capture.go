package main

import (
	"context"
	"fmt"
	"net/http"
	"sync"

	"github.com/kunalgoesbyken/gostman/capture"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const captureExchangeEventName = "capture:exchange"

type CaptureState struct {
	Running  bool   `json:"running"`
	Address  string `json:"address"`
	Upstream string `json:"upstream"`
}

type networkTransport struct {
	app *App
}

var (
	captureMutex   sync.Mutex
	captureServer  *capture.Server
	captureJournal capture.Journal
)

func (t networkTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return t.app.policy().Transport(false).RoundTrip(request)
}

func (a *App) StartCapture(settings capture.Settings) (CaptureState, error) {
	captureMutex.Lock()
	defer captureMutex.Unlock()

	if captureServer != nil {
		return CaptureState{}, fmt.Errorf("the capture is already running at %s", captureServer.Address())
	}
	if settings.Port == 0 {
		settings.Port = capture.DefaultPort
	}
	server, err := capture.Start(settings, networkTransport{a}, a.keepExchange)
	if err != nil {
		return CaptureState{}, err
	}
	captureServer = server
	return currentCaptureState(), nil
}

func (a *App) StopCapture() error {
	captureMutex.Lock()
	defer captureMutex.Unlock()

	if captureServer == nil {
		return nil
	}
	server := captureServer
	captureServer = nil
	return server.Stop()
}

func (a *App) CaptureStatus() CaptureState {
	captureMutex.Lock()
	defer captureMutex.Unlock()
	return currentCaptureState()
}

func (a *App) CapturedExchanges() []capture.Exchange {
	return captureJournal.Summaries()
}

func (a *App) CapturedDetails(ids []int64) []capture.Exchange {
	return captureJournal.Find(ids)
}

func (a *App) ClearCaptured() {
	captureJournal.Clear()
}

func (a *App) stopServers(ctx context.Context) {
	a.stopMockOnQuit(ctx)
	a.StopCapture()
	a.StopLoadTest()
}

func (a *App) keepExchange(exchange capture.Exchange) {
	stored := captureJournal.Add(exchange)
	wailsruntime.EventsEmit(a.ctx, captureExchangeEventName, stored.Summary())
}

func currentCaptureState() CaptureState {
	if captureServer == nil {
		return CaptureState{}
	}
	return CaptureState{Running: true, Address: captureServer.Address(), Upstream: captureServer.Upstream()}
}
