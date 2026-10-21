package main

import (
	"os"
	"sync"

	"github.com/kunalgoesbyken/gostman/deeplink"
	"github.com/wailsapp/wails/v2/pkg/options"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const openLinkEventName = "openlink:received"

type OpenLink struct {
	deeplink.Source
	Error string `json:"error,omitempty"`
}

type linkInbox struct {
	mu      sync.Mutex
	waiting []OpenLink
}

func (i *linkInbox) add(link OpenLink) {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.waiting = append(i.waiting, link)
}

func (i *linkInbox) take() []OpenLink {
	i.mu.Lock()
	defer i.mu.Unlock()
	taken := i.waiting
	i.waiting = nil
	return taken
}

func describeLink(raw string) OpenLink {
	source, err := deeplink.ParseLink(raw)
	if err != nil {
		return OpenLink{Error: err.Error()}
	}
	return OpenLink{Source: source}
}

func (a *App) receiveLink(raw string) {
	a.links.add(describeLink(raw))
	wailsruntime.EventsEmit(a.ctx, openLinkEventName)
}

func (a *App) receiveArguments(args []string) {
	if raw, found := deeplink.FindLink(args); found {
		a.receiveLink(raw)
	}
}

func (a *App) receiveLaunchArguments() {
	a.receiveArguments(os.Args[1:])
}

func (a *App) handleSecondInstance(data options.SecondInstanceData) {
	a.showExistingWindow()
	a.receiveArguments(data.Args)
}

func (a *App) TakeOpenLinks() []OpenLink {
	return a.links.take()
}

func (a *App) FetchLink(address string) deeplink.Reply {
	return deeplink.Fetch(a.ctx, address, a.policy(), deeplink.MaxBytes)
}
