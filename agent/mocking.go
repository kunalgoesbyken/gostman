package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/krockxz/gostman/mock"
	"github.com/krockxz/gostman/workspace"
)

const recentRequests = 20

type mocking struct {
	server *mock.Server
	log    sync.Mutex
	recent []mock.Entry
}

type mockArguments struct {
	Port    int `json:"port"`
	DelayMs int `json:"delay_ms"`
}

type mockReport struct {
	Running        bool         `json:"running"`
	Address        string       `json:"address,omitempty"`
	Routes         []mock.Route `json:"routes"`
	RecentRequests []mock.Entry `json:"recentRequests"`
}

func (m *mocking) record(entry mock.Entry) {
	m.log.Lock()
	defer m.log.Unlock()
	m.recent = append(m.recent, entry)
	if len(m.recent) > recentRequests {
		m.recent = m.recent[len(m.recent)-recentRequests:]
	}
}

func (m *mocking) served() []mock.Entry {
	m.log.Lock()
	defer m.log.Unlock()
	return append([]mock.Entry{}, m.recent...)
}

func (m *mocking) stop() error {
	if m.server == nil {
		return nil
	}
	server := m.server
	m.server = nil
	return server.Stop()
}

func (m *mocking) report() mockReport {
	if m.server == nil {
		return mockReport{Routes: []mock.Route{}, RecentRequests: []mock.Entry{}}
	}
	return mockReport{Running: true, Address: m.server.Address(), Routes: m.server.Routes(), RecentRequests: m.served()}
}

func mockSources(files workspace.Collection) []mock.Source {
	sources := make([]mock.Source, 0, len(files.Requests))
	for _, request := range files.Requests {
		sources = append(sources, mock.Source{
			ID:       request.Id,
			Name:     request.Name,
			Method:   request.Method,
			URL:      request.URL,
			Examples: request.Examples,
		})
	}
	return sources
}

func (d *Desk) variablesText() (string, error) {
	encoded, err := json.Marshal(d.client.session.Variables())
	return string(encoded), err
}

func (d *Desk) startMock(_ context.Context, current scene, arguments mockArguments) (mockReport, error) {
	if d.mocking.server != nil {
		return mockReport{}, fmt.Errorf("The mock server is already running at %s. Call stop_mock before starting it again.", d.mocking.server.Address())
	}
	variables, err := d.variablesText()
	if err != nil {
		return mockReport{}, err
	}
	settings := mock.Settings{Port: arguments.Port, DelayMs: arguments.DelayMs}
	if settings.Port == 0 {
		settings.Port = mock.DefaultPort
	}
	d.mocking.recent = nil
	server, err := mock.Start(mockSources(current.files), variables, settings, d.mocking.record)
	if err != nil {
		return mockReport{}, err
	}
	d.mocking.server = server
	return d.mocking.report(), nil
}

func (d *Desk) stopMock(_ context.Context, _ scene, _ noArguments) (mockReport, error) {
	if err := d.mocking.stop(); err != nil {
		return mockReport{}, err
	}
	return d.mocking.report(), nil
}

func (d *Desk) mockStatus(_ context.Context, current scene, _ noArguments) (mockReport, error) {
	if d.mocking.server == nil {
		return d.mocking.report(), nil
	}
	variables, err := d.variablesText()
	if err != nil {
		return mockReport{}, err
	}
	if _, err := d.mocking.server.Update(mockSources(current.files), variables); err != nil {
		return mockReport{}, err
	}
	return d.mocking.report(), nil
}
