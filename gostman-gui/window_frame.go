package main

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

const (
	windowFrameFile    = "window-frame"
	systemFrameSetting = "system"
	customFrameSetting = "custom"
)

type WindowFrame struct {
	Adjustable     bool `json:"adjustable"`
	Frameless      bool `json:"frameless"`
	SystemTitleBar bool `json:"systemTitleBar"`
}

func windowFramePath() string {
	return filepath.Join(appFolder, windowFrameFile)
}

func titleBarIsAdjustable() bool {
	return runtime.GOOS != "darwin"
}

func savedSystemTitleBar() bool {
	content, err := os.ReadFile(windowFramePath())
	return err == nil && strings.TrimSpace(string(content)) == systemFrameSetting
}

func opensFrameless() bool {
	return titleBarIsAdjustable() && !savedSystemTitleBar()
}

func (a *App) WindowFrame() WindowFrame {
	return WindowFrame{Adjustable: titleBarIsAdjustable(), Frameless: a.frameless, SystemTitleBar: savedSystemTitleBar()}
}

func (a *App) SaveSystemTitleBar(enabled bool) (WindowFrame, error) {
	setting := customFrameSetting
	if enabled {
		setting = systemFrameSetting
	}
	if err := os.MkdirAll(appFolder, 0755); err != nil {
		return WindowFrame{}, err
	}
	if err := os.WriteFile(windowFramePath(), []byte(setting), 0644); err != nil {
		return WindowFrame{}, err
	}
	return a.WindowFrame(), nil
}
