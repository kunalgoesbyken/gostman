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
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

const (
	sandboxWorkerPrefix = "/assets/sandbox.worker."
	sandboxPolicy       = "default-src 'none'; script-src 'unsafe-eval'"
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

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:            "Gostman",
		Width:            1280,
		Height:           820,
		MinWidth:         800,
		MinHeight:        600,
		AssetServer:      &assetserver.Options{Assets: assets, Middleware: isolateSandbox},
		BackgroundColour: &options.RGBA{R: 3, G: 7, B: 18, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.stopServersOnQuit,
		Menu:             applicationMenu(),
		Windows:          &windows.Options{Theme: windows.Dark},
		Bind:             []interface{}{app},
	})
	if err != nil {
		log.Fatal(err)
	}
}
