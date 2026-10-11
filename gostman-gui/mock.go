package main

import (
	"context"
	"fmt"
	"sync"

	"github.com/krockxz/gostman/mock"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const mockRequestEventName = "mock:request"

type MockState struct {
	Running bool         `json:"running"`
	Address string       `json:"address"`
	Routes  []mock.Route `json:"routes"`
}

var (
	mockMutex  sync.Mutex
	mockServer *mock.Server
)

func (a *App) MockRoutes(sources []mock.Source, variables string) ([]mock.Route, error) {
	return mock.Plan(sources, variables)
}

func (a *App) StartMock(sources []mock.Source, variables string, settings mock.Settings) (MockState, error) {
	mockMutex.Lock()
	defer mockMutex.Unlock()

	if mockServer != nil {
		return MockState{}, fmt.Errorf("the mock server is already running at %s", mockServer.Address())
	}
	if settings.Port == 0 {
		settings.Port = mock.DefaultPort
	}
	server, err := mock.Start(sources, variables, settings, a.emitMockRequest)
	if err != nil {
		return MockState{}, err
	}
	mockServer = server
	return currentMockState(), nil
}

func (a *App) UpdateMock(sources []mock.Source, variables string) (MockState, error) {
	mockMutex.Lock()
	defer mockMutex.Unlock()

	if mockServer == nil {
		return MockState{}, fmt.Errorf("the mock server is not running")
	}
	if _, err := mockServer.Update(sources, variables); err != nil {
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

func (a *App) stopMockOnQuit(context.Context) {
	a.StopMock()
}

func (a *App) emitMockRequest(entry mock.Entry) {
	wailsruntime.EventsEmit(a.ctx, mockRequestEventName, entry)
}

func currentMockState() MockState {
	if mockServer == nil {
		return MockState{Routes: []mock.Route{}}
	}
	return MockState{Running: true, Address: mockServer.Address(), Routes: mockServer.Routes()}
}
