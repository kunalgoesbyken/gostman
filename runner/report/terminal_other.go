//go:build !windows

package report

import "os"

func acceptsEscapes(file *os.File) bool {
	info, err := file.Stat()
	return err == nil && info.Mode()&os.ModeCharDevice != 0
}
