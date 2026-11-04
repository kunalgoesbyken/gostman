package main

import (
	"context"
	"crypto/ed25519"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"
)

const (
	releasesPage       = "https://github.com/kunalgoesbyken/gostman/releases"
	githubLatest       = "https://api.github.com/repos/kunalgoesbyken/gostman/releases/latest"
	githubDownloads    = releasesPage + "/download/"
	releaseTimeout     = 15 * time.Second
	maxReleaseBytes    = 1 << 20
	releaseUnavailable = "GitHub answered with HTTP %d"
	checksumsAsset     = "SHA256SUMS"
	signatureAsset     = checksumsAsset + ".sig"
	maxRedirects       = 10
)

var githubAssetHosts = []string{"github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"}

type Release struct {
	Version  string `json:"version"`
	URL      string `json:"url"`
	Newer    bool   `json:"newer"`
	Installs bool   `json:"installs"`
	Download string `json:"download,omitempty"`
}

type githubAsset struct {
	Name string `json:"name"`
	URL  string `json:"browser_download_url"`
	Size int64  `json:"size"`
}

type githubRelease struct {
	TagName string        `json:"tag_name"`
	HTMLURL string        `json:"html_url"`
	Assets  []githubAsset `json:"assets"`
}

type updateSource struct {
	latest     string
	downloads  string
	hosts      []string
	plainHTTP  bool
	manualOnly bool
	key        ed25519.PublicKey
}

type releaseChecksums struct {
	sums      githubAsset
	signature githubAsset
}

func githubSource(manualOnly bool) updateSource {
	return updateSource{latest: githubLatest, downloads: githubDownloads, hosts: githubAssetHosts, manualOnly: manualOnly, key: releaseKey()}
}

func (s updateSource) permits(address string) bool {
	return strings.HasPrefix(address, s.downloads) && !strings.Contains(strings.TrimPrefix(address, s.downloads), "..")
}

func (s updateSource) follows(target *url.URL) bool {
	secure := target.Scheme == "https" || (s.plainHTTP && target.Scheme == "http")
	return secure && slices.Contains(s.hosts, target.Host)
}

func (s updateSource) client(transport http.RoundTripper) *http.Client {
	return &http.Client{
		Transport: transport,
		CheckRedirect: func(next *http.Request, via []*http.Request) error {
			if len(via) >= maxRedirects || !s.follows(next.URL) {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}
}

func (r githubRelease) asset(name string) (githubAsset, bool) {
	for _, asset := range r.Assets {
		if asset.Name == name {
			return asset, true
		}
	}
	return githubAsset{}, false
}

func (r githubRelease) version() string {
	return strings.TrimPrefix(r.TagName, "v")
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

func (a *App) fetchRelease(ctx context.Context, source updateSource) (githubRelease, error) {
	ctx, cancel := context.WithTimeout(ctx, releaseTimeout)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, source.latest, nil)
	if err != nil {
		return githubRelease{}, err
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("User-Agent", "Gostman/"+currentVersion)
	response, err := source.client(a.updatePolicy().Transport(false)).Do(request)
	if err != nil {
		return githubRelease{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return githubRelease{}, fmt.Errorf(releaseUnavailable, response.StatusCode)
	}
	var latest githubRelease
	if err := json.NewDecoder(io.LimitReader(response.Body, maxReleaseBytes)).Decode(&latest); err != nil {
		return githubRelease{}, err
	}
	return latest, nil
}

func installableAsset(release githubRelease, source updateSource, plan installPlan) (githubAsset, releaseChecksums, bool) {
	if source.manualOnly || !plan.installs() || source.key == nil {
		return githubAsset{}, releaseChecksums{}, false
	}
	asset, hasAsset := release.asset(plan.Asset)
	sums, hasSums := release.asset(checksumsAsset)
	signature, hasSignature := release.asset(signatureAsset)
	usable := hasAsset && hasSums && hasSignature && source.permits(asset.URL) && source.permits(sums.URL) && source.permits(signature.URL)
	return asset, releaseChecksums{sums: sums, signature: signature}, usable
}

func (a *App) LatestRelease() (Release, error) {
	source := releaseSource()
	latest, err := a.fetchRelease(a.ctx, source)
	if err != nil {
		return Release{}, err
	}
	version := latest.version()
	plan := currentInstall()
	_, _, installs := installableAsset(latest, source, plan)
	release := Release{Version: version, URL: releasePage(latest.HTMLURL), Newer: isNewerVersion(version, currentVersion), Installs: installs}
	if asset, found := latest.asset(plan.Download); found && source.permits(asset.URL) {
		release.Download = asset.URL
	}
	return release, nil
}
