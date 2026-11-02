package main

import (
	"context"
	"crypto/rand"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"

	"github.com/kunalgoesbyken/gostman/capture"
	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/workspace"
)

type collector struct {
	mu       sync.Mutex
	stdout   io.Writer
	files    *workspace.Workspace
	folder   string
	seen     map[string]bool
	captured int
	saved    int
	journal  capture.Journal
}

func topLevelFolder(files *workspace.Workspace, name string) (string, error) {
	if name == "" {
		return "", nil
	}
	folders := files.Collection().Folders
	for _, folder := range folders {
		if folder.ParentId == "" && folder.Name == name {
			return folder.Id, nil
		}
	}
	created := workspace.Folder{Id: rand.Text(), Name: name}
	return created.Id, files.SaveFolders(append(folders, created))
}

func openCollector(root, folder string, stdout io.Writer) (*collector, error) {
	collecting := &collector{stdout: stdout, folder: folder, seen: map[string]bool{}}
	if root == "" {
		return collecting, nil
	}
	files, err := workspace.Open(root)
	if err != nil {
		return nil, err
	}
	for _, request := range files.Collection().Requests {
		collecting.seen[capture.Endpoint(request.Method, request.URL)] = true
	}
	collecting.files = files
	return collecting, nil
}

func (c *collector) isNew(exchange capture.Exchange) bool {
	return c.files != nil && exchange.IsSavable() && !c.seen[capture.Endpoint(exchange.Method, exchange.URL)]
}

func (c *collector) save(exchange capture.Exchange) (capture.Draft, error) {
	draft, err := exchange.Draft()
	if err != nil {
		return draft, err
	}
	folderID, err := topLevelFolder(c.files, c.folder)
	if err != nil {
		return draft, err
	}
	request := workspace.BlankRequest(rand.Text())
	request.Name, request.Method, request.URL = draft.Name, draft.Method, draft.URL
	request.Headers, request.Body, request.BodyType = draft.Headers, draft.Body, draft.BodyType
	request.Examples, request.FolderId = draft.Examples, folderID
	return draft, c.files.SaveRequests([]workspace.Request{request})
}

func savedNote(draft capture.Draft) string {
	note := "saved as " + draft.Name
	if len(draft.Withheld) > 0 {
		note += " without " + strings.Join(draft.Withheld, ", ")
	}
	if draft.Incomplete {
		note += ", body incomplete"
	}
	return note
}

func (c *collector) keep(exchange capture.Exchange) string {
	if exchange.Error != "" {
		return exchange.Error
	}
	if !c.isNew(exchange) {
		return ""
	}
	draft, err := c.save(exchange)
	if err != nil {
		return "not saved: " + err.Error()
	}
	c.seen[capture.Endpoint(exchange.Method, exchange.URL)] = true
	c.saved++
	return savedNote(draft)
}

func firedNote(exchange capture.Exchange) string {
	if len(exchange.Rules) == 0 {
		return ""
	}
	return "  [rules: " + strings.Join(exchange.Rules, ", ") + "]"
}

func (c *collector) record(exchange capture.Exchange) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.captured++
	c.journal.Add(exchange)
	fmt.Fprintf(c.stdout, "%s  %-7s %-28s %3d  %d ms  %d B  %s\n",
		exchange.Time.Format("15:04:05"), exchange.Method, exchange.Path, exchange.Status,
		exchange.DurationMs, exchange.Response.Size, c.keep(exchange)+firedNote(exchange))
}

func (c *collector) summary() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.files == nil {
		return fmt.Sprintf("Captured %d exchanges.", c.captured)
	}
	return fmt.Sprintf("Captured %d exchanges, saved %d new requests to %s. Bodies are saved as captured: check them for tokens before sharing.", c.captured, c.saved, c.files.Root())
}

func (c *collector) writeHAR(path string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	data, err := capture.HAR(c.journal.All(), currentVersion())
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func serveCapture(settings capture.Settings, collecting *collector, harPath string, stdout io.Writer) error {
	server, err := capture.Start(settings, engine.Policy{}.Transport(false), capture.Hooks{Exchange: collecting.record})
	if err != nil {
		return err
	}
	fmt.Fprintf(stdout, "Forwarding %s to %s. Point your app at the first address. Press Ctrl+C to stop.\n", server.Address(), server.Upstream())
	if len(settings.Rules) > 0 {
		fmt.Fprintf(stdout, "%d capture rules loaded.\n", len(settings.Rules))
	}
	fmt.Fprintln(stdout)

	interrupted, release := signal.NotifyContext(context.Background(), os.Interrupt)
	defer release()
	<-interrupted.Done()
	err = server.Stop()
	fmt.Fprintf(stdout, "\n%s\n", collecting.summary())
	if harPath != "" && err == nil {
		if err = collecting.writeHAR(harPath); err == nil {
			fmt.Fprintf(stdout, "Wrote %s.\n", harPath)
		}
	}
	return err
}

func rulesFor(rulesPath, root string) ([]capture.Rule, string, error) {
	switch {
	case rulesPath != "":
		config, err := capture.LoadConfig(rulesPath)
		return config.Rules, filepath.Dir(rulesPath), err
	case root != "":
		config, err := capture.LoadConfig(filepath.Join(root, capture.ConfigFileName))
		return config.Rules, root, err
	}
	return nil, "", nil
}

func breaksAnywhere(rules []capture.Rule) bool {
	for _, rule := range rules {
		if !rule.Disabled && rule.Break != "" {
			return true
		}
	}
	return false
}

func captureCommand(arguments []string, stdout, stderr *os.File) int {
	flags := flag.NewFlagSet("capture", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	upstream := flags.String("upstream", "", "")
	port := flags.Int("port", capture.DefaultPort, "")
	root := flags.String("workspace", "", "")
	folder := flags.String("folder", "", "")
	rulesPath := flags.String("rules", "", "")
	harPath := flags.String("har", "", "")
	positional, err := parseInterspersed(flags, arguments)
	switch {
	case err != nil:
		return misuse(stderr, err.Error())
	case len(positional) > 0:
		return misuse(stderr, "capture takes flags only")
	case *upstream == "":
		return misuse(stderr, "name the API to forward to with --upstream <url>")
	case *folder != "" && *root == "":
		return misuse(stderr, "--folder names a folder inside --workspace")
	}
	collecting, err := openCollector(*root, *folder, stdout)
	if err != nil {
		return complain(stderr, err)
	}
	rules, filesRoot, err := rulesFor(*rulesPath, *root)
	switch {
	case err != nil:
		return complain(stderr, err)
	case breaksAnywhere(rules):
		return misuse(stderr, "breakpoints hold an exchange until you release it in the desktop app; turn them off to capture from the command line")
	}
	settings := capture.Settings{Upstream: *upstream, Port: *port, Rules: rules, FilesRoot: filesRoot}
	if err := serveCapture(settings, collecting, *harPath, stdout); err != nil {
		return complain(stderr, err)
	}
	return exitPassed
}
