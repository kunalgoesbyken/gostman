package main

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"

	"github.com/krockxz/gostman/mock"
	"github.com/krockxz/gostman/openapi"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	mockRequestEventName = "mock:request"
	mockAppDataFile      = "mock.yaml"
)

type MockState struct {
	Running bool         `json:"running"`
	Address string       `json:"address"`
	Routes  []mock.Route `json:"routes"`
	Log     []mock.Entry `json:"log"`
}

var (
	mockMutex  sync.Mutex
	mockServer *mock.Server
)

func mockConfigPath() string {
	if folder := openFolder(); folder != nil {
		return filepath.Join(folder.Root(), mock.ConfigFileName)
	}
	return filepath.Join(appFolder, mockAppDataFile)
}

func (a *App) MockConfig() (mock.Config, error) {
	return mock.LoadConfig(mockConfigPath())
}

func (a *App) SaveMockConfig(config mock.Config) error {
	return mock.SaveConfig(mockConfigPath(), config)
}

func (a *App) MockFromSpec(source openapi.Source) (mock.Spec, error) {
	return mock.FromSpec(a.ctx, source, openapi.Options{Policy: a.policy(), AllowFiles: true})
}

func (a *App) MockRoutes(sources []mock.Source, variables string, config mock.Config) ([]mock.Route, error) {
	return mock.Plan(sources, variables, config)
}

func (a *App) StartMock(sources []mock.Source, variables string, config mock.Config) (MockState, error) {
	mockMutex.Lock()
	defer mockMutex.Unlock()

	if mockServer != nil {
		return MockState{}, fmt.Errorf("the mock server is already running at %s", mockServer.Address())
	}
	if config.Settings.Port == 0 {
		config.Settings.Port = mock.DefaultPort
	}
	server, err := mock.Start(sources, variables, config, a.emitMockRequest)
	if err != nil {
		return MockState{}, err
	}
	mockServer = server
	return currentMockState(), nil
}

func (a *App) UpdateMock(sources []mock.Source, variables string, config mock.Config) (MockState, error) {
	mockMutex.Lock()
	defer mockMutex.Unlock()

	if mockServer == nil {
		return MockState{}, fmt.Errorf("the mock server is not running")
	}
	if _, err := mockServer.Update(sources, variables, config); err != nil {
		return MockState{}, err
	}
	return currentMockState(), nil
}

func (a *App) StopMock() error {
	mockMutex.Lock()
	defer mockMutex.Unlock()

	if mockServer == nil {
		return nil
	}
	server := mockServer
	mockServer = nil
	return server.Stop()
}

func (a *App) MockStatus() MockState {
	mockMutex.Lock()
	defer mockMutex.Unlock()
	return currentMockState()
}

func (a *App) ClearMockLog() {
	mockMutex.Lock()
	defer mockMutex.Unlock()
	if mockServer != nil {
		mockServer.ClearLog()
	}
}

func (a *App) stopMockOnQuit(context.Context) {
	a.StopMock()
}

func (a *App) emitMockRequest(entry mock.Entry) {
	wailsruntime.EventsEmit(a.ctx, mockRequestEventName, entry)
}

func currentMockState() MockState {
	if mockServer == nil {
		return MockState{Routes: []mock.Route{}, Log: []mock.Entry{}}
	}
	return MockState{Running: true, Address: mockServer.Address(), Routes: mockServer.Routes(), Log: mockServer.Log()}
}
