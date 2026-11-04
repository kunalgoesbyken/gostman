//go:build dev || updatetest

package main

import (
	"net/url"
	"os"
	"strings"
)

const (
	updateFeedVariable = "GOSTMAN_UPDATE_FEED"
	updateKeyVariable  = "GOSTMAN_UPDATE_KEY"
)

func releaseSource() updateSource {
	feed := strings.TrimSuffix(os.Getenv(updateFeedVariable), "/")
	parsed, err := url.Parse(feed)
	if feed == "" || err != nil || parsed.Host == "" {
		return githubSource(true)
	}
	return updateSource{
		latest:    feed + "/releases/latest",
		downloads: feed + "/download/",
		hosts:     []string{parsed.Host},
		plainHTTP: parsed.Scheme == "http",
		key:       parseKey(os.Getenv(updateKeyVariable)),
	}
}
