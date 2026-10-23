package secrets

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/childproc"
)

const (
	maxCommandOutput = 1 << 20
	commandWaitDelay = 2 * time.Second
	batchUnsafe      = "\"&|<>^%!()\r\n"
)

type tool struct {
	program string
	label   string
	install string
	timeout time.Duration
}

type outcome struct {
	stdout []byte
	stderr string
	failed bool
}

type cappedBuffer struct {
	bytes.Buffer
}

func (b *cappedBuffer) Write(chunk []byte) (int, error) {
	if room := maxCommandOutput - b.Len(); room < len(chunk) {
		b.Buffer.Write(chunk[:max(room, 0)])
		return len(chunk), nil
	}
	return b.Buffer.Write(chunk)
}

func isFile(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func (t tool) locate(custom string) (string, error) {
	if custom != "" {
		if isFile(custom) {
			return custom, nil
		}
		return "", fmt.Errorf("the program %q set on the connection does not exist", custom)
	}
	if path, err := exec.LookPath(t.program); err == nil {
		return path, nil
	}
	for _, folder := range programFolders() {
		for _, suffix := range programSuffixes {
			if candidate := filepath.Join(folder, t.program+suffix); isFile(candidate) {
				return candidate, nil
			}
		}
	}
	return "", fmt.Errorf("%s is not installed, or Gostman cannot find it. Install it from %s, or set its location in the connection's Program field", t.label, t.install)
}

func isBatchFile(program string) bool {
	extension := strings.ToLower(filepath.Ext(program))
	return extension == ".cmd" || extension == ".bat"
}

func batchSafe(program string, args []string) error {
	if !isBatchFile(program) {
		return nil
	}
	for _, arg := range args {
		if strings.ContainsAny(arg, batchUnsafe) {
			return fmt.Errorf("%s runs through the batch file %s, which cannot be given %q safely. Use the ID instead, or install the program's .exe and set it in the Program field", filepath.Base(program), program, arg)
		}
	}
	return nil
}

func (t tool) run(ctx context.Context, program string, args []string, env map[string]string) (outcome, error) {
	if err := batchSafe(program, args); err != nil {
		return outcome{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, t.timeout)
	defer cancel()
	command := exec.CommandContext(ctx, program, args...)
	command.Env = os.Environ()
	for name, value := range env {
		command.Env = append(command.Env, name+"="+value)
	}
	command.WaitDelay = commandWaitDelay
	childproc.NoWindow(command)
	var stdout, stderr cappedBuffer
	command.Stdout, command.Stderr = &stdout, &stderr
	err := command.Run()
	switch {
	case errors.Is(ctx.Err(), context.DeadlineExceeded):
		return outcome{}, fmt.Errorf("%s did not finish within %s", t.label, t.timeout)
	case ctx.Err() != nil:
		return outcome{}, ctx.Err()
	}
	var exit *exec.ExitError
	if err != nil && !errors.As(err, &exit) {
		return outcome{}, fmt.Errorf("%s could not be started: %w", t.label, err)
	}
	return outcome{stdout: stdout.Bytes(), stderr: strings.TrimSpace(stderr.String()), failed: err != nil}, nil
}

func firstLine(text string) string {
	for _, line := range strings.Split(text, "\n") {
		if line = strings.TrimSpace(line); line != "" {
			return line
		}
	}
	return ""
}

func isGUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for i, r := range value {
		switch i {
		case 8, 13, 18, 23:
			if r != '-' {
				return false
			}
		default:
			if !strings.ContainsRune("0123456789abcdefABCDEF", r) {
				return false
			}
		}
	}
	return true
}

func noVersions(ref Ref, label string) error {
	if ref.Version != "" {
		return fmt.Errorf("%s has no versions; leave the version empty", label)
	}
	return nil
}
