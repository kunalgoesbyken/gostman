//go:build !windows

package main

import (
	"os"
	"os/exec"
	"strconv"
	"syscall"

	"github.com/kunalgoesbyken/gostman/childproc"
)

const (
	relaunchScript = `while kill -0 "$1" 2>/dev/null; do sleep 0.2; done; shift; exec "$@"`
	relaunchName   = "gostman-relaunch"
	macOpen        = "/usr/bin/open"
)

func relaunchCommand(plan installPlan) []string {
	if plan.Method == methodBundle {
		return []string{macOpen, plan.Target}
	}
	return []string{plan.Target}
}

func relaunchAfterExit(plan installPlan, _ string) error {
	args := append([]string{"-c", relaunchScript, relaunchName, strconv.Itoa(os.Getpid())}, relaunchCommand(plan)...)
	command := exec.Command("/bin/sh", args...)
	childproc.NoWindow(command)
	command.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	return command.Start()
}
