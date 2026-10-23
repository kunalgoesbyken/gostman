package secrets

import (
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/windows/registry"
)

var programSuffixes = []string{".exe", ".cmd"}

var pathKeys = []struct {
	root registry.Key
	path string
}{
	{registry.CURRENT_USER, `Environment`},
	{registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\Session Manager\Environment`},
}

func savedPath() []string {
	var folders []string
	for _, location := range pathKeys {
		key, err := registry.OpenKey(location.root, location.path, registry.QUERY_VALUE)
		if err != nil {
			continue
		}
		value, _, err := key.GetStringValue("Path")
		key.Close()
		if err != nil {
			continue
		}
		for _, folder := range filepath.SplitList(value) {
			if expanded, err := registry.ExpandString(folder); err == nil && strings.TrimSpace(expanded) != "" {
				folders = append(folders, expanded)
			}
		}
	}
	return folders
}

func programFolders() []string {
	folders := savedPath()
	if local := os.Getenv("LOCALAPPDATA"); local != "" {
		folders = append(folders, filepath.Join(local, "Microsoft", "WinGet", "Links"))
	}
	if roaming := os.Getenv("APPDATA"); roaming != "" {
		folders = append(folders, filepath.Join(roaming, "npm"))
	}
	if home, err := os.UserHomeDir(); err == nil {
		folders = append(folders, filepath.Join(home, ".cargo", "bin"), filepath.Join(home, "scoop", "shims"))
	}
	return folders
}
