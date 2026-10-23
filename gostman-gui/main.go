package main

import (
	"embed"
	"log"
	"net/http"
	"runtime"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

const (
	sandboxWorkerPrefix = "/assets/sandbox.worker."
	sandboxPolicy       = "default-src 'none'; script-src 'unsafe-eval'"
	singleInstanceID    = "app.gostman.desktop"
	maxWindowSide       = 16384
)

func isolateSandbox(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, sandboxWorkerPrefix) {
			w.Header().Set("Content-Security-Policy", sandboxPolicy)
		}
		next.ServeHTTP(w, r)
	})
}

func applicationMenu() *menu.Menu {
	if runtime.GOOS != "darwin" {
		return nil
	}
	return menu.NewMenuFromItems(menu.AppMenu(), menu.EditMenu(), menu.WindowMenu())
}

func (a *App) showExistingWindow() {
	wailsruntime.WindowUnminimise(a.ctx)
	wailsruntime.Show(a.ctx)
}

func main() {
	app := NewApp()
	theme := savedWindowTheme()

	err := wails.Run(&options.App{
		Title:            "Gostman",
		Width:            1280,
		Height:           820,
		MinWidth:         800,
		MinHeight:        600,
		MaxWidth:         maxWindowSide,
		MaxHeight:        maxWindowSide,
		Frameless:        runtime.GOOS != "darwin",
		AssetServer:      &assetserver.Options{Assets: assets, Middleware: isolateSandbox},
		BackgroundColour: &theme.background,
		OnStartup:        app.startup,
		OnShutdown:       app.stopServersOnQuit,
		Menu:             applicationMenu(),
		Windows:          &windows.Options{Theme: theme.frame},
		Mac:              &mac.Options{OnUrlOpen: app.receiveLink},
		Bind:             []interface{}{app},
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId:               singleInstanceID,
			OnSecondInstanceLaunch: app.handleSecondInstance,
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
