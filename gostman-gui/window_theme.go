package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	windowThemeFile    = "window-theme"
	defaultWindowTheme = "dark"
)

type windowTheme struct {
	background options.RGBA
	frame      windows.Theme
	applyFrame func(context.Context)
}

var windowThemes = map[string]windowTheme{
	"dark":  {background: options.RGBA{R: 3, G: 7, B: 17, A: 1}, frame: windows.Dark, applyFrame: wailsruntime.WindowSetDarkTheme},
	"light": {background: options.RGBA{R: 255, G: 255, B: 255, A: 1}, frame: windows.Light, applyFrame: wailsruntime.WindowSetLightTheme},
}

func windowThemePath() string {
	return filepath.Join(appFolder, windowThemeFile)
}

func savedWindowTheme() windowTheme {
	content, err := os.ReadFile(windowThemePath())
	if err != nil {
		return windowThemes[defaultWindowTheme]
	}
	if theme, known := windowThemes[strings.TrimSpace(string(content))]; known {
		return theme
	}
	return windowThemes[defaultWindowTheme]
}

func (a *App) applyWindowTheme(theme windowTheme) {
	theme.applyFrame(a.ctx)
	wailsruntime.WindowSetBackgroundColour(a.ctx, theme.background.R, theme.background.G, theme.background.B, theme.background.A)
}

func (a *App) SaveWindowTheme(name string) error {
	theme, known := windowThemes[name]
	if !known {
		return fmt.Errorf("unknown window theme %q", name)
	}
	a.applyWindowTheme(theme)
	if err := os.MkdirAll(appFolder, 0755); err != nil {
		return err
	}
	return os.WriteFile(windowThemePath(), []byte(name), 0644)
}
