package main

import (
	"flag"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/kunalgoesbyken/gostman/workspace"
)

const sessionVariable = "GOSTMAN_SESSION"

func sessionFlag(flags *flag.FlagSet, session *string) {
	flags.StringVar(session, "session", os.Getenv(sessionVariable), "")
}

func changesCommand(arguments []string, stdout, stderr *os.File) int {
	flags := flag.NewFlagSet("changes", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	since := flags.String("since", "", "")
	mine := flags.Bool("mine", false, "")
	asJSON := flags.Bool("json", false, "")
	var session string
	sessionFlag(flags, &session)
	positional, err := parseInterspersed(flags, arguments)
	if err != nil {
		return misuse(stderr, err.Error())
	}
	window, err := workspace.ParseChangeWindow(*since)
	switch {
	case err != nil:
		return misuse(stderr, "--since: "+err.Error())
	case len(positional) > 1:
		return misuse(stderr, "name at most one workspace folder")
	case *mine && session == "":
		return misuse(stderr, "--mine needs --session or the "+sessionVariable+" variable to know which session is yours")
	}
	root := currentFolder
	if len(positional) == 1 {
		root = positional[0]
	}
	files, err := workspace.Open(root)
	if err != nil {
		return complain(stderr, err)
	}
	journal, err := files.Changes()
	if err != nil {
		return complain(stderr, err)
	}
	only := ""
	if *mine {
		only = session
	}
	feed := workspace.NewChangeFeed(workspace.RecentChanges(journal, window, time.Now(), only))
	if *asJSON {
		if err := writeJSON(stdout, feed); err != nil {
			return complain(stderr, err)
		}
		return exitPassed
	}
	if len(feed.Summary) == 0 {
		fmt.Fprintf(stdout, "No changes in the last %s.\n", window)
		return exitPassed
	}
	for _, line := range feed.Summary {
		fmt.Fprintln(stdout, line)
	}
	return exitPassed
}
