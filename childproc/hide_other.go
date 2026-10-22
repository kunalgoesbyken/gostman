//go:build !windows

package childproc

import "os/exec"

func NoWindow(*exec.Cmd) {}
