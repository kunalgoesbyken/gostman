//go:build !windows

package main

func supportsSystemBackdrop() bool {
	return false
}
