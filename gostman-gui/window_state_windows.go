package main

import (
	"context"
	"os"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	placesBeforeShow = true

	windowClassName    = "wailsWindow"
	showHidden         = 0
	showMinimised      = 2
	showMaximised      = 3
	restoreToMaximised = 2
	primaryMonitorFlag = 1
	enumContinue       = 1
)

type nativePoint struct{ X, Y int32 }

type nativeRect struct{ Left, Top, Right, Bottom int32 }

type nativePlacement struct {
	Length         uint32
	Flags          uint32
	ShowCmd        uint32
	MinPosition    nativePoint
	MaxPosition    nativePoint
	NormalPosition nativeRect
	Device         nativeRect
}

type nativeMonitor struct {
	Size    uint32
	Monitor nativeRect
	Work    nativeRect
	Flags   uint32
}

var (
	user32                  = windows.NewLazySystemDLL("user32.dll")
	procEnumWindows         = user32.NewProc("EnumWindows")
	procWindowProcessID     = user32.NewProc("GetWindowThreadProcessId")
	procClassName           = user32.NewProc("GetClassNameW")
	procGetPlacement        = user32.NewProc("GetWindowPlacement")
	procSetPlacement        = user32.NewProc("SetWindowPlacement")
	procEnumDisplayMonitors = user32.NewProc("EnumDisplayMonitors")
	procGetMonitorInfo      = user32.NewProc("GetMonitorInfoW")

	windowEnumeration  uintptr
	monitorEnumeration uintptr
	enumerationsReady  sync.Once
	foundWindow        uintptr
	collectedMonitors  []nativeMonitor
	enumerationGuard   sync.Mutex
)

func prepareEnumerations() {
	enumerationsReady.Do(func() {
		windowEnumeration = windows.NewCallback(func(handle, _ uintptr) uintptr {
			if belongsToThisWindow(handle) {
				foundWindow = handle
				return 0
			}
			return enumContinue
		})
		monitorEnumeration = windows.NewCallback(func(monitor, _, _, _ uintptr) uintptr {
			info := nativeMonitor{Size: uint32(unsafe.Sizeof(nativeMonitor{}))}
			if ok, _, _ := procGetMonitorInfo.Call(monitor, uintptr(unsafe.Pointer(&info))); ok != 0 {
				collectedMonitors = append(collectedMonitors, info)
			}
			return enumContinue
		})
	})
}

func belongsToThisWindow(handle uintptr) bool {
	var process uint32
	procWindowProcessID.Call(handle, uintptr(unsafe.Pointer(&process)))
	if process != uint32(os.Getpid()) {
		return false
	}
	name := make([]uint16, 64)
	length, _, _ := procClassName.Call(handle, uintptr(unsafe.Pointer(&name[0])), uintptr(len(name)))
	return windows.UTF16ToString(name[:length]) == windowClassName
}

func mainWindowHandle() uintptr {
	prepareEnumerations()
	enumerationGuard.Lock()
	defer enumerationGuard.Unlock()
	foundWindow = 0
	procEnumWindows.Call(windowEnumeration, 0)
	return foundWindow
}

func connectedMonitors() []nativeMonitor {
	prepareEnumerations()
	enumerationGuard.Lock()
	defer enumerationGuard.Unlock()
	collectedMonitors = nil
	procEnumDisplayMonitors.Call(0, 0, monitorEnumeration, 0)
	return collectedMonitors
}

func rectOf(native nativeRect) windowRect {
	return windowRect{Left: int(native.Left), Top: int(native.Top), Right: int(native.Right), Bottom: int(native.Bottom)}
}

func nativeRectOf(rect windowRect) nativeRect {
	return nativeRect{Left: int32(rect.Left), Top: int32(rect.Top), Right: int32(rect.Right), Bottom: int32(rect.Bottom)}
}

func workAreasPrimaryFirst(monitors []nativeMonitor) []windowRect {
	var areas []windowRect
	for _, monitor := range monitors {
		area := rectOf(monitor.Work)
		if monitor.Flags&primaryMonitorFlag != 0 {
			areas = append([]windowRect{area}, areas...)
			continue
		}
		areas = append(areas, area)
	}
	return areas
}

func workspaceOffset(monitors []nativeMonitor) (left, top int) {
	for _, monitor := range monitors {
		if monitor.Flags&primaryMonitorFlag != 0 {
			return int(monitor.Work.Left - monitor.Monitor.Left), int(monitor.Work.Top - monitor.Monitor.Top)
		}
	}
	return 0, 0
}

func readPlacement(handle uintptr) (nativePlacement, bool) {
	placement := nativePlacement{Length: uint32(unsafe.Sizeof(nativePlacement{}))}
	ok, _, _ := procGetPlacement.Call(handle, uintptr(unsafe.Pointer(&placement)))
	return placement, ok != 0
}

func placeWindow(_ context.Context, state windowState) {
	handle := mainWindowHandle()
	monitors := connectedMonitors()
	areas := workAreasPrimaryFirst(monitors)
	if handle == 0 || len(areas) == 0 {
		return
	}
	placement, ok := readPlacement(handle)
	if !ok {
		return
	}
	fitted, _ := fitWindow(state.rect(), true, areas)
	offsetLeft, offsetTop := workspaceOffset(monitors)
	placement.Flags = 0
	placement.ShowCmd = showHidden
	placement.NormalPosition = nativeRectOf(fitted.shifted(-offsetLeft, -offsetTop))
	procSetPlacement.Call(handle, uintptr(unsafe.Pointer(&placement)))
}

func currentWindow(_ context.Context, _ windowState, _ bool) (windowState, bool) {
	handle := mainWindowHandle()
	if handle == 0 {
		return windowState{}, false
	}
	placement, ok := readPlacement(handle)
	if !ok {
		return windowState{}, false
	}
	offsetLeft, offsetTop := workspaceOffset(connectedMonitors())
	screen := rectOf(placement.NormalPosition).shifted(offsetLeft, offsetTop)
	if !plausibleWindow(screen) {
		return windowState{}, false
	}
	maximised := placement.ShowCmd == showMaximised || (placement.ShowCmd == showMinimised && placement.Flags&restoreToMaximised != 0)
	return windowStateOf(screen, maximised), true
}
