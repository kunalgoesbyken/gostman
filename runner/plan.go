package runner

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/kunalgoesbyken/gostman/runner/sandbox"
	"github.com/kunalgoesbyken/gostman/workspace"
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

type placement struct {
	Index     int    `json:"index"`
	FolderID  string `json:"folderId"`
	SortOrder int64  `json:"sortOrder"`
}

func (s *Session) Normalized(stored, earlier Collection) (Collection, error) {
	known := map[string]Request{}
	if len(earlier.Normalized) == len(earlier.Requests) {
		for index, raw := range earlier.Requests {
			known[string(raw)] = earlier.Normalized[index]
		}
	}
	var fresh []json.RawMessage
	for _, raw := range stored.Requests {
		if _, found := known[string(raw)]; !found {
			fresh = append(fresh, raw)
		}
	}
	requests, err := normalize(s.state.scripts, Collection{Requests: fresh})
	if err != nil {
		return stored, err
	}
	for index, raw := range fresh {
		known[string(raw)] = requests[index]
	}
	stored.Normalized = make([]Request, len(stored.Requests))
	for index, raw := range stored.Requests {
		stored.Normalized[index] = known[string(raw)]
	}
	return stored, nil
}

func normalize(scripts *sandbox.Sandbox, stored Collection) ([]Request, error) {
	if stored.Normalized != nil {
		return stored.Normalized, nil
	}
	requests := make([]Request, 0, len(stored.Requests))
	if len(stored.Requests) == 0 {
		return requests, nil
	}
	if err := scripts.Call("normalizeRequests", &requests, stored.Requests); err == nil {
		return requests, nil
	}
	return normalizeEach(scripts, stored)
}

func normalizeEach(scripts *sandbox.Sandbox, stored Collection) ([]Request, error) {
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

func inFolder(scripts *sandbox.Sandbox, folders []Folder, requests []Request, folderID string, sharedOrder bool) ([]Request, error) {
	placements := make([]placement, len(requests))
	for index, request := range requests {
		placements[index] = placement{Index: index, FolderID: request.FolderID, SortOrder: request.SortOrder}
	}
	var placed []placement
	if err := scripts.Call("requestsInFolder", &placed, folders, placements, folderID, sharedOrder); err != nil {
		return nil, err
	}
	ordered := make([]Request, len(placed))
	for position, found := range placed {
		ordered[position] = requests[found.Index]
	}
	return ordered, nil
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
	ordered, err := inFolder(scripts, folders, requests, folderID, stored.SharedOrder)
	if err != nil {
		return plan{}, err
	}
	planned := plan{library: requests, folderNames: map[string]string{}}
	for _, candidate := range paths {
		planned.folderNames[candidate.ID] = candidate.joined()
	}
	lineageOf := stored.lineages()
	for _, request := range ordered {
		request.Lineage = lineageOf(request.FolderID)
		if options.selects(request, planned.folderNames[request.FolderID]) {
			planned.requests = append(planned.requests, options.applyTo(request))
		}
	}
	if filters := options.filters(); len(filters) > 0 && len(planned.requests) == 0 {
		return plan{}, fmt.Errorf("no request matches: %s", strings.Join(filters, "; "))
	}
	return planned, nil
}

func (o Options) filters() []string {
	var described []string
	if len(o.Only) > 0 {
		described = append(described, strings.Join(o.Only, ", "))
	}
	if len(o.Tags) > 0 {
		described = append(described, "tagged "+strings.Join(o.Tags, " or "))
	}
	if len(o.ExcludeTags) > 0 {
		described = append(described, "not tagged "+strings.Join(o.ExcludeTags, " or "))
	}
	return described
}

func (o Options) selects(request Request, folder string) bool {
	return o.selectsName(request, folder) && o.selectsTags(request.allTags())
}

func (o Options) selectsTags(tags []string) bool {
	if len(o.Tags) > 0 && !workspace.SharesTag(tags, o.Tags) {
		return false
	}
	return !workspace.SharesTag(tags, o.ExcludeTags)
}

func (o Options) selectsName(request Request, folder string) bool {
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
