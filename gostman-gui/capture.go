package main

import (
	"context"
	"fmt"
	"net/http"
	"path/filepath"
	"sync"

	"github.com/kunalgoesbyken/gostman/capture"
	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/mock"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	captureExchangeEventName = "capture:exchange"
	captureHeldEventName     = "capture:held"
	captureSettledEventName  = "capture:settled"
	captureAppDataFile       = "capture.yaml"
)

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
	config, err := capture.LoadConfig(captureConfigPath())
	if err != nil {
		return CaptureState{}, err
	}
	config = trustedCaptureConfig(config)
	settings.Rules, settings.BreakSeconds = config.Rules, config.BreakSeconds
	if folder := openFolder(); folder != nil && !config.Restricted {
		settings.FilesRoot = folder.Root()
	}
	server, err := capture.Start(settings, networkTransport{a}, capture.Hooks{
		Exchange: a.keepExchange,
		Held:     func(held capture.Held) { wailsruntime.EventsEmit(a.ctx, captureHeldEventName, held) },
		Settled:  func(id int64) { wailsruntime.EventsEmit(a.ctx, captureSettledEventName, id) },
	})
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

func captureConfigPath() string {
	if folder := openFolder(); folder != nil {
		return filepath.Join(folder.Root(), capture.ConfigFileName)
	}
	return filepath.Join(appFolder, captureAppDataFile)
}

func trustedCaptureConfig(config capture.Config) capture.Config {
	if isTrustedHere() {
		return config
	}
	return config.Withheld()
}

func (a *App) CaptureConfig() (capture.Config, error) {
	config, err := capture.LoadConfig(captureConfigPath())
	return trustedCaptureConfig(config), err
}

func (a *App) SaveCaptureConfig(config capture.Config) error {
	captureMutex.Lock()
	defer captureMutex.Unlock()
	if !isTrustedHere() {
		return fmt.Errorf("trust this folder to change its capture rules")
	}
	files := openFolder() != nil
	if err := capture.Validate(config.Rules, files); err != nil {
		return err
	}
	if err := capture.SaveConfig(captureConfigPath(), config); err != nil {
		return err
	}
	if captureServer != nil {
		config = trustedCaptureConfig(config)
		return captureServer.UpdateRules(config.Rules, config.BreakSeconds)
	}
	return nil
}

func (a *App) ExportCaptureRules(rules []capture.Rule) (string, error) {
	data, err := capture.ExportRules(rules)
	return string(data), err
}

func (a *App) ImportCaptureRules(text string) ([]capture.Rule, error) {
	return capture.ImportRules([]byte(text), openFolder() != nil && isTrustedHere())
}

func (a *App) CapturedHAR(ids []int64) (string, error) {
	exchanges := captureJournal.All()
	if len(ids) > 0 {
		exchanges = captureJournal.Find(ids)
	}
	data, err := capture.HAR(exchanges, engine.ProductVersion)
	return string(data), err
}

func (a *App) CapturedMockRule(id int64) (mock.Rule, error) {
	for _, exchange := range captureJournal.Find([]int64{id}) {
		if rule, ok := exchange.MockRule(); ok {
			return rule, nil
		}
		return mock.Rule{}, fmt.Errorf("only a complete text response can become a mock rule")
	}
	return mock.Rule{}, fmt.Errorf("the exchange is no longer kept")
}

func runningCapture() (*capture.Server, error) {
	captureMutex.Lock()
	defer captureMutex.Unlock()
	if captureServer == nil {
		return nil, fmt.Errorf("the capture is not running")
	}
	return captureServer, nil
}

func (a *App) HeldExchanges() []capture.Held {
	server, err := runningCapture()
	if err != nil {
		return []capture.Held{}
	}
	return server.Held()
}

func (a *App) ReleaseHeld(id int64, decision capture.Decision) error {
	server, err := runningCapture()
	if err != nil {
		return err
	}
	return server.Release(id, decision)
}

func (a *App) DropHeld(id int64) error {
	server, err := runningCapture()
	if err != nil {
		return err
	}
	return server.DropHeld(id)
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
