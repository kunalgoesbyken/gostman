package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/kunalgoesbyken/gostman/childproc"
)

const (
	relaunchWait     = "$ErrorActionPreference = 'SilentlyContinue'; Wait-Process -Id %d -Timeout 120"
	relaunchInstall  = "try { Start-Process -FilePath %s -ArgumentList %s -Wait } catch {}"
	relaunchStart    = "Start-Process -FilePath %s"
	installerOptions = "/S /D=%s"
)

func quotedForPowerShell(text string) string {
	return "'" + strings.ReplaceAll(text, "'", "''") + "'"
}

func powerShell() string {
	return filepath.Join(os.Getenv("SystemRoot"), "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
}

func relaunchScript(plan installPlan, staged string) string {
	steps := []string{fmt.Sprintf(relaunchWait, os.Getpid())}
	if plan.Method == methodInstaller {
		options := fmt.Sprintf(installerOptions, filepath.Dir(plan.Target))
		steps = append(steps, fmt.Sprintf(relaunchInstall, quotedForPowerShell(staged), quotedForPowerShell(options)))
	}
	steps = append(steps, fmt.Sprintf(relaunchStart, quotedForPowerShell(plan.Target)))
	return strings.Join(steps, "; ")
}

func relaunchAfterExit(plan installPlan, staged string) error {
	command := exec.Command(powerShell(), "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", relaunchScript(plan, staged))
	childproc.NoWindow(command)
	return command.Start()
}
