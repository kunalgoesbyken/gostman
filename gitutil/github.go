package gitutil

import (
	"context"
	"errors"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"strings"

	"github.com/kunalgoesbyken/gostman/childproc"
)

var repositoryName = regexp.MustCompile(`^(?:[A-Za-z0-9][A-Za-z0-9-]{0,38}/)?[A-Za-z0-9._-]{1,100}$`)

func GitHubCLIInstalled() bool {
	_, err := exec.LookPath("gh")
	return err == nil
}

func ValidRepositoryName(name string) error {
	if !repositoryName.MatchString(name) || strings.HasSuffix(name, ".git") || name == "." || name == ".." {
		return errors.New("a repository name uses letters, digits, dots, dashes and underscores, optionally after an owner and a slash")
	}
	return nil
}

func NewRepositoryURL(name string, private bool) string {
	visibility := "public"
	if private {
		visibility = "private"
	}
	bare := name
	if slash := strings.LastIndex(name, "/"); slash >= 0 {
		bare = name[slash+1:]
	}
	query := url.Values{"name": {bare}, "visibility": {visibility}}
	return "https://github.com/new?" + query.Encode()
}

func (r Repo) CreateGitHubRepository(name string, private bool) (string, error) {
	if r.Restricted {
		return "", ErrRestricted
	}
	if err := ValidRepositoryName(name); err != nil {
		return "", err
	}
	if !GitHubCLIInstalled() {
		return "", errors.New("the GitHub command line tool (gh) was not found")
	}
	visibility := "--public"
	if private {
		visibility = "--private"
	}
	ctx, cancel := context.WithTimeout(context.Background(), networkTimeout)
	defer cancel()
	command := exec.CommandContext(ctx, "gh", "repo", "create", name, visibility, "--source", ".", "--remote", "origin")
	command.Dir = r.Dir
	childproc.NoWindow(command)
	command.Env = append(os.Environ(), "GH_PROMPT_DISABLED=1", "NO_COLOR=1", "GH_NO_UPDATE_NOTIFIER=1")
	var stdout, stderr cappedBuffer
	command.Stdout, command.Stderr = &stdout, &stderr
	if err := command.Run(); err != nil {
		return "", describeFailure(stderr.String(), stdout.String(), err)
	}
	return strings.TrimSpace(Redact(stdout.String())), nil
}
