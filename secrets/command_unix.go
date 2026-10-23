//go:build !windows

package secrets

import (
	"os"
	"path/filepath"
)

var programSuffixes = []string{""}

func programFolders() []string {
	folders := []string{"/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/snap/bin"}
	if home, err := os.UserHomeDir(); err == nil {
		folders = append(folders, filepath.Join(home, ".local", "bin"), filepath.Join(home, ".npm-global", "bin"), filepath.Join(home, ".cargo", "bin"), filepath.Join(home, "bin"))
	}
	return folders
}
