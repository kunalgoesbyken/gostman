//go:build !dev && !updatetest

package main

func releaseSource() updateSource {
	return githubSource(false)
}
