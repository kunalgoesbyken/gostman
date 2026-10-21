package gitutil

import (
	"errors"
	"net/url"
	"strings"
)

type location struct {
	host string
	repo string
}

func parseLocation(raw string) (location, error) {
	trimmed := strings.TrimSpace(raw)
	if strings.Contains(trimmed, "://") {
		parsed, err := url.Parse(trimmed)
		if err != nil || parsed.Hostname() == "" {
			return location{}, errors.New("the remote address could not be read")
		}
		return location{host: strings.ToLower(parsed.Hostname()), repo: cleanRepo(parsed.Path)}, nil
	}
	at := strings.Index(trimmed, "@")
	colon := strings.Index(trimmed, ":")
	if colon < 0 {
		return location{}, errors.New("the remote address could not be read")
	}
	host := trimmed[at+1 : colon]
	return location{host: strings.ToLower(host), repo: cleanRepo(trimmed[colon+1:])}, nil
}

func cleanRepo(path string) string {
	trimmed := strings.Trim(path, "/")
	return strings.TrimSuffix(trimmed, ".git")
}

func escapeBranch(branch string) string {
	parts := strings.Split(branch, "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}

func CompareURL(remote, branch string) (string, error) {
	place, err := parseLocation(remote)
	if err != nil {
		return "", err
	}
	if strings.Count(place.repo, "/") < 1 || place.host == "" {
		return "", errors.New("the remote address does not name a repository")
	}
	switch {
	case place.host == "github.com" || strings.HasPrefix(place.host, "github."):
		return "https://" + place.host + "/" + place.repo + "/compare/" + escapeBranch(branch) + "?expand=1", nil
	case place.host == "gitlab.com" || strings.HasPrefix(place.host, "gitlab."):
		return "https://" + place.host + "/" + place.repo + "/-/merge_requests/new?merge_request%5Bsource_branch%5D=" + url.QueryEscape(branch), nil
	case place.host == "bitbucket.org":
		return "https://" + place.host + "/" + place.repo + "/pull-requests/new?source=" + url.QueryEscape(branch), nil
	}
	return "", errors.New("Gostman can open a pull request page for GitHub, GitLab and Bitbucket remotes only")
}
