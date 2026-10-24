package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"
)

const (
	latestReleaseAddress = "https://api.github.com/repos/kunalgoesbyken/gostman/releases/latest"
	releasesPage         = "https://github.com/kunalgoesbyken/gostman/releases"
	releaseTimeout       = 15 * time.Second
	maxReleaseBytes      = 1 << 20
	releaseUnavailable   = "GitHub answered with HTTP %d"
)

type Release struct {
	Version string `json:"version"`
	URL     string `json:"url"`
	Newer   bool   `json:"newer"`
}

type githubRelease struct {
	TagName string `json:"tag_name"`
	HTMLURL string `json:"html_url"`
}

func versionNumbers(version string) []int {
	core, _, _ := strings.Cut(strings.TrimPrefix(strings.TrimSpace(version), "v"), "-")
	fields := strings.Split(core, ".")
	numbers := make([]int, len(fields))
	for i, field := range fields {
		number, err := strconv.Atoi(field)
		if err != nil {
			return nil
		}
		numbers[i] = number
	}
	return numbers
}

func padded(numbers []int, length int) []int {
	return append(numbers, make([]int, length-len(numbers))...)
}

func isNewerVersion(candidate, current string) bool {
	next, now := versionNumbers(candidate), versionNumbers(current)
	if next == nil || now == nil {
		return false
	}
	length := max(len(next), len(now))
	return slices.Compare(padded(next, length), padded(now, length)) > 0
}

func releasePage(address string) string {
	if strings.HasPrefix(address, releasesPage+"/") {
		return address
	}
	return releasesPage
}

func (a *App) LatestRelease() (Release, error) {
	ctx, cancel := context.WithTimeout(a.ctx, releaseTimeout)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, latestReleaseAddress, nil)
	if err != nil {
		return Release{}, err
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("User-Agent", "Gostman/"+currentVersion)
	client := &http.Client{Transport: a.policy().Transport(false)}
	response, err := client.Do(request)
	if err != nil {
		return Release{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return Release{}, fmt.Errorf(releaseUnavailable, response.StatusCode)
	}
	var latest githubRelease
	if err := json.NewDecoder(io.LimitReader(response.Body, maxReleaseBytes)).Decode(&latest); err != nil {
		return Release{}, err
	}
	version := strings.TrimPrefix(latest.TagName, "v")
	return Release{Version: version, URL: releasePage(latest.HTMLURL), Newer: isNewerVersion(version, currentVersion)}, nil
}
