package report

import (
	"os"

	"golang.org/x/sys/windows"
)

func acceptsEscapes(file *os.File) bool {
	console := windows.Handle(file.Fd())
	var mode uint32
	if windows.GetConsoleMode(console, &mode) != nil {
		return false
	}
	return windows.SetConsoleMode(console, mode|windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING) == nil
}
