package main

import (
	"embed"
	"log"
	"runtime"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

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
		AssetServer:      &assetserver.Options{Assets: assets},
		BackgroundColour: &options.RGBA{R: 3, G: 7, B: 18, A: 1},
		OnStartup:        app.startup,
		Menu:             applicationMenu(),
		Windows:          &windows.Options{Theme: windows.Dark},
		Bind:             []interface{}{app},
	})
	if err != nil {
		log.Fatal(err)
	}
}
