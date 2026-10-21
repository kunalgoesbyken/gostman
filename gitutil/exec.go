package gitutil

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const (
	localTimeout    = 30 * time.Second
	networkTimeout  = 3 * time.Minute
	outputLimit     = 8 << 20
	installHint     = "Git was not found on this computer. Install it from https://git-scm.com/downloads and restart Gostman."
	credentialsHint = "Git could not authenticate. Gostman never asks for passwords: sign in through your git credential helper or add your SSH key to the ssh-agent, then try again."
)

var (
	ErrNotInstalled = errors.New(installHint)
	ErrRestricted   = errors.New("this folder is not trusted yet, so Git can only be read. Trust the folder to change anything")
	ErrNoIdentity   = errors.New("Git does not know who you are. Set user.name and user.email (git config --global user.name \"Your Name\", git config --global user.email you@example.com), then commit again")
	userinfo        = regexp.MustCompile(`(?i)([a-z][a-z0-9+.-]*://)[^/@\s]+@`)
	authFailures    = []string{
		"authentication failed",
		"could not read username",
		"could not read password",
		"terminal prompts disabled",
		"permission denied (publickey",
		"host key verification failed",
		"invalid username or password",
		"the requested url returned error: 401",
		"the requested url returned error: 403",
	}
)

type Repo struct {
	Dir        string
	Restricted bool
}

type Error struct {
	Message string
}

func (e *Error) Error() string { return e.Message }

func Installed() bool {
	_, err := exec.LookPath("git")
	return err == nil
}

func Redact(text string) string {
	return userinfo.ReplaceAllString(text, "${1}")
}

func environment() []string {
	return append(os.Environ(),
		"GIT_TERMINAL_PROMPT=0",
		"GIT_OPTIONAL_LOCKS=0",
		"GIT_EDITOR=true",
		"GIT_PAGER=cat",
		"GCM_INTERACTIVE=never",
		"GIT_ALLOW_PROTOCOL=file:git:http:https:ssh",
		"LC_ALL=C",
		"LANGUAGE=C",
	)
}

type cappedBuffer struct {
	bytes.Buffer
}

func (b *cappedBuffer) Write(p []byte) (int, error) {
	if b.Len() < outputLimit {
		b.Buffer.Write(p)
	}
	return len(p), nil
}

func describeFailure(stderr, stdout string, runErr error) error {
	text := strings.TrimSpace(Redact(stderr))
	if text == "" {
		text = strings.TrimSpace(Redact(stdout))
	}
	if text == "" {
		text = runErr.Error()
	}
	lower := strings.ToLower(text)
	for _, marker := range authFailures {
		if strings.Contains(lower, marker) {
			return &Error{Message: credentialsHint + "\n\n" + text}
		}
	}
	return &Error{Message: text}
}

func (r Repo) hardening() []string {
	args := []string{"--literal-pathspecs", "--no-pager", "-c", "core.quotepath=off", "-c", "core.fsmonitor=false", "-c", "protocol.ext.allow=never", "-c", "protocol.fd.allow=never"}
	if !r.Restricted {
		return args
	}
	out, err := r.exec(context.Background(), localTimeout, nil, "config", "--local", "--name-only", "--get-regexp", `^filter\.`)
	if err != nil {
		return args
	}
	seen := map[string]bool{}
	for _, key := range strings.Fields(out) {
		parts := strings.Split(key, ".")
		if len(parts) < 3 {
			continue
		}
		driver := strings.Join(parts[1:len(parts)-1], ".")
		if seen[driver] {
			continue
		}
		seen[driver] = true
		for _, hook := range []string{"clean", "smudge", "process"} {
			args = append(args, "-c", "filter."+driver+"."+hook+"=")
		}
	}
	return args
}

func (r Repo) exec(ctx context.Context, timeout time.Duration, stdin []byte, args ...string) (string, error) {
	if !Installed() {
		return "", ErrNotInstalled
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	command := exec.CommandContext(ctx, "git", args...)
	command.Dir = r.Dir
	command.Env = environment()
	if stdin != nil {
		command.Stdin = bytes.NewReader(stdin)
	}
	var stdout, stderr cappedBuffer
	command.Stdout, command.Stderr = &stdout, &stderr
	err := command.Run()
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return stdout.String(), &Error{Message: fmt.Sprintf("git %s took longer than %s and was stopped", args[len(args)-1], timeout)}
	}
	if err != nil {
		return stdout.String(), describeFailure(stderr.String(), stdout.String(), err)
	}
	return stdout.String(), nil
}

func (r Repo) run(args ...string) (string, error) {
	return r.exec(context.Background(), localTimeout, nil, append(r.hardening(), args...)...)
}

func (r Repo) runNetwork(args ...string) (string, error) {
	if r.Restricted {
		return "", ErrRestricted
	}
	return r.exec(context.Background(), networkTimeout, nil, append(r.hardening(), args...)...)
}

func (r Repo) runWrite(args ...string) (string, error) {
	if r.Restricted {
		return "", ErrRestricted
	}
	return r.run(args...)
}

func (r Repo) runWritePlain(args ...string) (string, error) {
	if r.Restricted {
		return "", ErrRestricted
	}
	return r.exec(context.Background(), localTimeout, nil, append(r.hardening()[1:], args...)...)
}

func (r Repo) runWriteInput(stdin []byte, args ...string) (string, error) {
	if r.Restricted {
		return "", ErrRestricted
	}
	return r.exec(context.Background(), localTimeout, stdin, append(r.hardening(), args...)...)
}

func Top(dir string) (string, error) {
	out, err := Repo{Dir: dir}.run("rev-parse", "--show-toplevel")
	if err != nil {
		return "", err
	}
	return filepath.Clean(strings.TrimSpace(out)), nil
}

func SameFolder(a, b string) bool {
	first, err := os.Stat(a)
	if err != nil {
		return false
	}
	second, err := os.Stat(b)
	if err != nil {
		return false
	}
	return os.SameFile(first, second)
}

func ValidRef(name string) error {
	if name == "" {
		return errors.New("a name is required")
	}
	if strings.HasPrefix(name, "-") {
		return errors.New("a name cannot start with a dash")
	}
	if len(name) > 200 {
		return errors.New("that name is too long")
	}
	if strings.Contains(name, "..") || strings.Contains(name, "@{") || name == "@" {
		return errors.New("that name has a sequence Git does not allow")
	}
	for _, r := range name {
		if r < 0x21 || r == 0x7f || strings.ContainsRune(`~^:?*[\`, r) {
			return fmt.Errorf("a name cannot contain %q", r)
		}
	}
	for _, part := range strings.Split(name, "/") {
		if part == "" || strings.HasPrefix(part, ".") || strings.HasSuffix(part, ".lock") {
			return errors.New("that name has a part Git does not allow")
		}
	}
	if strings.HasSuffix(name, ".") {
		return errors.New("a name cannot end with a dot")
	}
	return nil
}

func ValidPath(path string) (string, error) {
	if path == "" || strings.ContainsRune(path, 0) {
		return "", errors.New("a file path is required")
	}
	slashed := filepath.ToSlash(path)
	if strings.HasPrefix(slashed, "-") || strings.HasPrefix(slashed, ":") {
		return "", fmt.Errorf("%q is not a valid file path", path)
	}
	if !filepath.IsLocal(filepath.FromSlash(slashed)) {
		return "", fmt.Errorf("%q is not a path inside the folder", path)
	}
	clean := filepath.ToSlash(filepath.Clean(filepath.FromSlash(slashed)))
	for _, segment := range strings.Split(clean, "/") {
		if isGitDirName(segment) {
			return "", errors.New("files inside .git cannot be used")
		}
	}
	return clean, nil
}

var shortGitName = regexp.MustCompile(`^git~[0-9]+$`)

func isGitDirName(segment string) bool {
	normalized := strings.ToLower(strings.TrimRight(segment, ". "))
	return normalized == ".git" || shortGitName.MatchString(normalized) || strings.HasPrefix(normalized, ".git:")
}

var revisionPattern = regexp.MustCompile(`^[0-9a-f]{4,64}$`)

func ValidRevision(rev string) error {
	if !revisionPattern.MatchString(rev) {
		return errors.New("that is not a commit id")
	}
	return nil
}

func ValidURL(url string) error {
	trimmed := strings.TrimSpace(url)
	if trimmed == "" {
		return errors.New("a repository address is required")
	}
	if strings.HasPrefix(trimmed, "-") {
		return errors.New("a repository address cannot start with a dash")
	}
	for _, r := range trimmed {
		if r < 0x21 || r == 0x7f {
			return errors.New("a repository address cannot contain spaces or control characters")
		}
	}
	if strings.Contains(trimmed, "::") {
		return errors.New("that kind of address is not allowed")
	}
	return nil
}
