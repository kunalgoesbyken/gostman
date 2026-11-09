package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/options"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	windowStateFile = "window-state.json"
	defaultWidth    = 1280
	defaultHeight   = 820
)

type windowState struct {
	Left      int  `json:"left"`
	Top       int  `json:"top"`
	Width     int  `json:"width"`
	Height    int  `json:"height"`
	Maximised bool `json:"maximised,omitempty"`
}

func (s windowState) rect() windowRect {
	return windowRect{Left: s.Left, Top: s.Top, Right: s.Left + s.Width, Bottom: s.Top + s.Height}
}

func windowStateOf(rect windowRect, maximised bool) windowState {
	return windowState{Left: rect.Left, Top: rect.Top, Width: rect.width(), Height: rect.height(), Maximised: maximised}
}

func windowStatePath() string {
	return filepath.Join(appFolder, windowStateFile)
}

func loadWindowState() (windowState, bool) {
	content, err := os.ReadFile(windowStatePath())
	if err != nil {
		return windowState{}, false
	}
	var state windowState
	if json.Unmarshal(content, &state) != nil || !plausibleWindow(state.rect()) {
		return windowState{}, false
	}
	return state, true
}

func writeWindowState(state windowState) error {
	content, err := json.Marshal(state)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(appFolder, 0755); err != nil {
		return err
	}
	staged := windowStatePath() + ".tmp"
	if err := os.WriteFile(staged, content, 0644); err != nil {
		return err
	}
	return os.Rename(staged, windowStatePath())
}

func startingWindow(state windowState, remembered bool) (width, height int, start options.WindowStartState) {
	if !remembered {
		return defaultWidth, defaultHeight, options.Normal
	}
	if state.Maximised && startsMaximised {
		start = options.Maximised
	}
	if placesBeforeShow {
		return defaultWidth, defaultHeight, start
	}
	return state.Width, state.Height, start
}

func (a *App) restoreWindow() {
	defer func() { _ = recover() }()
	a.windowRestore.Do(func() {
		trackWindow(a.ctx)
		if a.hasSavedWindow {
			placeWindow(a.ctx, a.savedWindow)
		}
	})
}

func (a *App) restoreWindowOnceShown(context.Context) {
	if !placesBeforeShow {
		a.restoreWindow()
	}
}

func (a *App) rememberWindow(ctx context.Context) bool {
	defer func() { _ = recover() }()
	if wailsruntime.WindowIsFullscreen(ctx) {
		return false
	}
	state, known := currentWindow(ctx, a.savedWindow, a.hasSavedWindow)
	if known {
		_ = writeWindowState(state)
	}
	return false
}
