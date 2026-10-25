package main

import (
	"strings"
	"sync"

	"github.com/kunalgoesbyken/gostman/workspace"
)

type collectionStore interface {
	collection(data SavedData) (SavedData, error)
	saveRequests(requests []Request) error
	deleteRequest(id string) error
	saveFolders(folders []Folder) error
	saveEnvironments(environments []Environment, activeId string) error
	saveVariables(text, meta string) error
	saveSettings(settings workspace.Settings) error
	shareOrder() error
}

type appDataStore struct{}

func (appDataStore) collection(data SavedData) (SavedData, error) {
	return data, nil
}

func (appDataStore) saveRequests(requests []Request) error {
	return mutateData(func(data *SavedData) {
		positions := make(map[string]int, len(data.Requests))
		for i, saved := range data.Requests {
			positions[saved.Id] = i
		}
		for _, request := range requests {
			if position, exists := positions[request.Id]; exists {
				data.Requests[position] = request
				continue
			}
			positions[request.Id] = len(data.Requests)
			data.Requests = append(data.Requests, request)
		}
	})
}

func (appDataStore) deleteRequest(id string) error {
	return mutateData(func(data *SavedData) {
		kept := data.Requests[:0]
		for _, request := range data.Requests {
			if request.Id != id {
				kept = append(kept, request)
			}
		}
		data.Requests = kept
	})
}

func (appDataStore) saveFolders(folders []Folder) error {
	return mutateData(func(data *SavedData) {
		data.Folders = folders
	})
}

func (appDataStore) saveEnvironments(environments []Environment, activeId string) error {
	return mutateData(func(data *SavedData) {
		data.Variables = ""
		data.Environments = environments
		data.ActiveEnvironmentId = activeId
	})
}

func (appDataStore) saveVariables(text, meta string) error {
	return mutateData(func(data *SavedData) {
		data.CollectionVariables = text
		data.CollectionVariablesMeta = meta
	})
}

func (appDataStore) saveSettings(settings workspace.Settings) error {
	return mutateData(func(data *SavedData) {
		data.CollectionSettings = settings
	})
}

func (appDataStore) shareOrder() error {
	return mutateData(func(data *SavedData) {
		data.SharedOrder = true
	})
}

type activeCollection struct {
	mu     sync.RWMutex
	store  collectionStore
	notice string
}

var storage = &activeCollection{store: appDataStore{}}

func (c *activeCollection) current() collectionStore {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.store
}

func (c *activeCollection) use(store collectionStore) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.store = store
}

func (c *activeCollection) announce(notice string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.notice = strings.TrimSpace(c.notice + " " + notice)
}

func (c *activeCollection) takeNotice() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	notice := c.notice
	c.notice = ""
	return notice
}
