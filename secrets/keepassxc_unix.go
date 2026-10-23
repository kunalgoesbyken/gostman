//go:build !windows

package secrets

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"time"
)

const (
	keepassxcDialTimeout = 3 * time.Second
	keepassxcAppFolder   = "org.keepassxc.KeePassXC"
)

func keepassxcSockets() []string {
	var folders []string
	if runtimeDir := os.Getenv("XDG_RUNTIME_DIR"); runtimeDir != "" {
		folders = append(folders, filepath.Join(runtimeDir, "app", keepassxcAppFolder), runtimeDir)
	} else {
		folders = append(folders, filepath.Join(os.TempDir(), "runtime-"+os.Getenv("USER")))
	}
	if home, err := os.UserHomeDir(); err == nil {
		folders = append(folders, filepath.Join(home, "snap", "keepassxc", "common"))
	}
	if runtime.GOOS == "darwin" {
		folders = append(folders, os.TempDir())
	}
	sockets := make([]string, len(folders))
	for i, folder := range folders {
		sockets[i] = filepath.Join(folder, keepassxcServer)
	}
	return sockets
}

func ownedByUser(socket string) error {
	info, err := os.Stat(socket)
	if err != nil {
		return err
	}
	owner, isKnown := info.Sys().(*syscall.Stat_t)
	if !isKnown || int(owner.Uid) != os.Getuid() {
		return fmt.Errorf("%s belongs to another user", socket)
	}
	return nil
}

func dialKeePassXC(ctx context.Context) (net.Conn, error) {
	ctx, cancel := context.WithTimeout(ctx, keepassxcDialTimeout)
	defer cancel()
	var dialer net.Dialer
	failure := errors.New("no KeePassXC socket")
	for _, socket := range keepassxcSockets() {
		if err := ownedByUser(socket); err != nil {
			failure = err
			continue
		}
		conn, err := dialer.DialContext(ctx, "unix", socket)
		if err == nil {
			return conn, nil
		}
		failure = err
	}
	return nil, failure
}
