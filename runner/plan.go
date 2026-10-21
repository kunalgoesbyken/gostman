package runner

import (
	"fmt"
	"strings"

	"github.com/kunalgoesbyken/gostman/runner/sandbox"
)

const pathSeparator = "/"

type folderPath struct {
	ID   string   `json:"id"`
	Path []string `json:"path"`
}

func (f folderPath) joined() string {
	return strings.Join(f.Path, pathSeparator)
}

func (f folderPath) name() string {
	return f.Path[len(f.Path)-1]
}

type plan struct {
	library     []Request
	requests    []Request
	folderNames map[string]string
}

func normalize(scripts *sandbox.Sandbox, stored Collection) ([]Request, error) {
	requests := make([]Request, 0, len(stored.Requests))
	for index, raw := range stored.Requests {
		var request Request
		if err := scripts.Call("normalizeRequest", &request, raw); err != nil {
			return nil, fmt.Errorf("request %d of the collection cannot be read: %w", index+1, err)
		}
		requests = append(requests, request)
	}
	return requests, nil
}

func filterPaths(paths []folderPath, matches func(folderPath) bool) []folderPath {
	var kept []folderPath
	for _, candidate := range paths {
		if matches(candidate) {
			kept = append(kept, candidate)
		}
	}
	return kept
}

func describePaths(paths []folderPath) string {
	names := make([]string, 0, len(paths))
	for _, candidate := range paths {
		names = append(names, candidate.joined())
	}
	return strings.Join(names, ", ")
}

func chooseFolder(paths []folderPath, wanted string) (string, error) {
	wanted = strings.Trim(wanted, pathSeparator)
	if wanted == "" {
		return "", nil
	}
	matches := filterPaths(paths, func(candidate folderPath) bool { return candidate.joined() == wanted })
	if len(matches) == 0 {
		matches = filterPaths(paths, func(candidate folderPath) bool { return candidate.name() == wanted })
	}
	switch {
	case len(matches) == 1:
		return matches[0].ID, nil
	case len(matches) > 1:
		return "", fmt.Errorf("%q matches several folders (%s); pass a full path", wanted, describePaths(matches))
	case len(paths) == 0:
		return "", fmt.Errorf("there is no folder named %q: the collection has no folders", wanted)
	default:
		return "", fmt.Errorf("there is no folder named %q; the collection has %s", wanted, describePaths(paths))
	}
}

func (o Options) applyTo(request Request) Request {
	if request.Options.TimeoutMs == 0 {
		request.Options.TimeoutMs = int(o.Timeout.Milliseconds())
	}
	if o.Insecure {
		request.Options.InsecureTLS = true
	}
	request.Options = withStreamBudget(request.Options, o.streamSeconds())
	return request
}

func prepare(scripts *sandbox.Sandbox, stored Collection, options Options) (plan, error) {
	requests, err := normalize(scripts, stored)
	if err != nil {
		return plan{}, err
	}
	folders := append([]Folder{}, stored.Folders...)
	var paths []folderPath
	if err := scripts.Call("folderPaths", &paths, folders); err != nil {
		return plan{}, err
	}
	folderID, err := chooseFolder(paths, options.Folder)
	if err != nil {
		return plan{}, err
	}
	var ordered []Request
	if err := scripts.Call("requestsInFolder", &ordered, folders, requests, folderID); err != nil {
		return plan{}, err
	}
	planned := plan{library: requests, folderNames: map[string]string{}}
	for _, candidate := range paths {
		planned.folderNames[candidate.ID] = candidate.joined()
	}
	lineageOf := stored.lineages()
	for _, request := range ordered {
		if options.selects(request, planned.folderNames[request.FolderID]) {
			request.Lineage = lineageOf(request.FolderID)
			planned.requests = append(planned.requests, options.applyTo(request))
		}
	}
	if len(options.Only) > 0 && len(planned.requests) == 0 {
		return plan{}, fmt.Errorf("no request matches %s", strings.Join(options.Only, ", "))
	}
	return planned, nil
}

func (o Options) selects(request Request, folder string) bool {
	if len(o.Only) == 0 {
		return true
	}
	qualified := request.Name
	if folder != "" {
		qualified = folder + pathSeparator + request.Name
	}
	for _, wanted := range o.Only {
		if wanted == request.ID || wanted == request.Name || wanted == qualified {
			return true
		}
	}
	return false
}
