package main

import "golang.org/x/sys/windows"

const firstSystemBackdropBuild = 22621

func supportsSystemBackdrop() bool {
	return windows.RtlGetVersion().BuildNumber >= firstSystemBackdropBuild
}
