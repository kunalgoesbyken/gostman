//go:build !windows

package main

import (
	"context"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const placesBeforeShow = false

func screenArea(screen wailsruntime.Screen) windowRect {
	return windowRect{Right: screen.Size.Width, Bottom: screen.Size.Height}
}

func currentScreenArea(ctx context.Context) (windowRect, bool) {
	screens, err := wailsruntime.ScreenGetAll(ctx)
	if err != nil || len(screens) == 0 {
		return windowRect{}, false
	}
	chosen := screens[0]
	for _, screen := range screens {
		if screen.IsCurrent {
			chosen = screen
			break
		}
		if screen.IsPrimary {
			chosen = screen
		}
	}
	area := screenArea(chosen)
	return area, !area.empty()
}

func placeWindow(ctx context.Context, state windowState) {
	area, known := currentScreenArea(ctx)
	if !known {
		return
	}
	fitted, placed := fitWindow(state.rect(), true, []windowRect{area})
	wailsruntime.WindowSetSize(ctx, fitted.width(), fitted.height())
	if placed {
		wailsruntime.WindowSetPosition(ctx, fitted.Left, fitted.Top)
	}
}

func currentWindow(ctx context.Context, previous windowState, hasPrevious bool) (windowState, bool) {
	if wailsruntime.WindowIsMinimised(ctx) {
		return windowState{}, false
	}
	if wailsruntime.WindowIsMaximised(ctx) {
		if !hasPrevious {
			return windowState{}, false
		}
		previous.Maximised = true
		return previous, true
	}
	width, height := wailsruntime.WindowGetSize(ctx)
	left, top := wailsruntime.WindowGetPosition(ctx)
	rect := windowRect{Left: left, Top: top, Right: left + width, Bottom: top + height}
	if !plausibleWindow(rect) {
		return windowState{}, false
	}
	return windowStateOf(rect, false), true
}
