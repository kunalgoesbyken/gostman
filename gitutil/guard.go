package gitutil

import (
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

const markerScanLimit = 1 << 20

var reservedDeviceNames = map[string]bool{"con": true, "prn": true, "aux": true, "nul": true}

var errReservedName = errors.New("that name is reserved by Windows and cannot be used for a branch; choose another")

func (r Repo) unresolvedPaths() ([]string, error) {
	status, err := r.Status()
	if err != nil {
		return nil, err
	}
	var paths []string
	for _, change := range status.Changes {
		if change.Conflict || r.hasMarkers(change.Path) {
			paths = append(paths, change.Path)
		}
	}
	return paths, nil
}

func (r Repo) hasMarkers(file string) bool {
	full, err := r.absolute(file)
	if err != nil {
		return false
	}
	handle, err := os.Open(full)
	if err != nil {
		return false
	}
	defer handle.Close()
	content, err := io.ReadAll(io.LimitReader(handle, markerScanLimit))
	return err == nil && hasConflictMarkers(string(content))
}

func (r Repo) refuseUnresolved() error {
	paths, err := r.unresolvedPaths()
	if err != nil {
		return err
	}
	if len(paths) == 0 {
		return nil
	}
	return fmt.Errorf("resolve the conflicts in %s before committing", strings.Join(paths, ", "))
}

func isReservedDeviceName(part string) bool {
	stem, _, _ := strings.Cut(strings.ToLower(part), ".")
	if reservedDeviceNames[stem] {
		return true
	}
	if len(stem) != 4 || (!strings.HasPrefix(stem, "com") && !strings.HasPrefix(stem, "lpt")) {
		return false
	}
	return stem[3] >= '1' && stem[3] <= '9'
}

func validNewBranch(name string) error {
	if err := ValidRef(name); err != nil {
		return err
	}
	for _, part := range strings.Split(name, "/") {
		if isReservedDeviceName(part) {
			return errReservedName
		}
	}
	return nil
}
