package childproc

import (
	"os/exec"
	"syscall"
)

const createNoWindow = 0x08000000

func NoWindow(command *exec.Cmd) {
	command.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
}
