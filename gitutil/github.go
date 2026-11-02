package gitutil

import (
	"context"
	"errors"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"unicode"

	"github.com/kunalgoesbyken/gostman/childproc"
)

const repositoryNameLimit = 140

func GitHubCLIInstalled() bool {
	_, err := exec.LookPath("gh")
	return err == nil
}

func ValidRepositoryName(name string) error {
	if name == "" || len(name) > repositoryNameLimit || strings.HasPrefix(name, "-") || strings.Count(name, "/") > 1 {
		return errors.New("a repository name is one name, optionally after an owner and a slash, and does not start with a dash")
	}
	if strings.IndexFunc(name, func(character rune) bool { return !unicode.IsPrint(character) || unicode.IsSpace(character) }) >= 0 {
		return errors.New("a repository name cannot contain spaces or control characters")
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
