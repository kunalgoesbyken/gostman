package scan

import (
	"cmp"
	"encoding/json"
	"slices"
	"strings"

	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	pathSeparator    = "/"
	collectionLabel  = "Collection"
	unnamedLabel     = "Unnamed"
	maxFolderDepth   = 64
	variableLabel    = "variable"
	graphqlVariables = "graphql variables"
	grpcMessage      = "grpc message"
	mcpArguments     = "mcp arguments"
	socketMessages   = "saved messages"
)

func Scan(collection workspace.Collection, options Options) Report {
	s := &scanner{options: options, seen: map[string]bool{}}
	top := site{kind: KindCollection, path: collectionLabel}
	s.settings(top, collection.Settings)
	s.variables(top, variableLabel, collection.Variables)
	paths := folderPaths(collection.Folders)
	for _, folder := range collection.Folders {
		s.folder(paths[folder.Id], folder)
	}
	for _, request := range collection.Requests {
		s.request(requestSite(paths, request), request)
	}
	for _, environment := range collection.Environments {
		s.environment(environment)
	}
	return Report{
		Scanned: Counts{
			Requests:     len(collection.Requests),
			Folders:      len(collection.Folders),
			Environments: len(collection.Environments),
		},
		Findings:  s.sorted(),
		Truncated: s.truncated,
	}
}

func (s *scanner) sorted() []Finding {
	found := s.findings
	if found == nil {
		found = []Finding{}
	}
	slices.SortStableFunc(found, func(a, b Finding) int {
		return cmp.Or(
			cmp.Compare(severityRanks[b.Severity], severityRanks[a.Severity]),
			cmp.Compare(a.Location.Path, b.Location.Path),
			cmp.Compare(a.Location.Field, b.Location.Field),
			cmp.Compare(a.Rule, b.Rule),
			cmp.Compare(a.Fingerprint, b.Fingerprint),
		)
	})
	return found
}

func folderPaths(folders []workspace.Folder) map[string]string {
	byID := make(map[string]workspace.Folder, len(folders))
	for _, folder := range folders {
		byID[folder.Id] = folder
	}
	paths := make(map[string]string, len(folders))
	for _, folder := range folders {
		paths[folder.Id] = strings.Join(ancestry(byID, folder), pathSeparator)
	}
	return paths
}

func ancestry(byID map[string]workspace.Folder, folder workspace.Folder) []string {
	var names []string
	visited := map[string]bool{}
	for current, found := folder, true; found && !visited[current.Id] && len(names) < maxFolderDepth; current, found = byID[current.ParentId] {
		visited[current.Id] = true
		names = append([]string{nameOf(current.Name)}, names...)
	}
	return names
}

func nameOf(name string) string {
	if name == "" {
		return unnamedLabel
	}
	return name
}

func requestSite(paths map[string]string, request workspace.Request) site {
	path := nameOf(request.Name)
	if parent := paths[request.FolderId]; parent != "" {
		path = parent + pathSeparator + path
	}
	return site{kind: KindRequest, path: path, requestID: request.Id}
}

func (s *scanner) folder(path string, folder workspace.Folder) {
	at := site{kind: KindFolder, path: path}
	s.settings(at, folder.Settings)
	s.variables(at, variableLabel, folder.Variables)
}

func (s *scanner) request(at site, request workspace.Request) {
	s.address(at, request.URL)
	s.rows(at, "header", request.Headers)
	s.rows(at, "query", request.QueryParams)
	s.body(at, request.BodyType, request.Body)
	s.examine(at, "graphql query", request.GraphqlQuery, nil)
	s.structured(at, graphqlVariables, request.GraphqlVariables)
	s.structured(at, grpcMessage, request.GrpcMessage)
	s.structured(at, mcpArguments, request.McpArguments)
	s.structured(at, socketMessages, request.SocketMessages)
	s.variables(at, "request variable", request.Vars)
	s.scripts(at, request.PreScript, request.PostScript)
	s.auth(at, request.Auth)
	if !s.options.SkipExamples {
		s.examples(at, request.Examples)
	}
}

func (s *scanner) environment(environment workspace.Environment) {
	at := site{kind: KindEnvironment, path: nameOf(environment.Name)}
	s.mapped(at, variableLabel, parseObject(environment.Variables), referencedNames(environment.Meta))
}

func referencedNames(meta string) map[string]bool {
	var flags map[string]struct {
		Ref json.RawMessage `json:"ref"`
	}
	if json.Unmarshal([]byte(strings.TrimSpace(meta)), &flags) != nil {
		return nil
	}
	names := map[string]bool{}
	for name, flag := range flags {
		if len(flag.Ref) > 0 && string(flag.Ref) != "null" {
			names[name] = true
		}
	}
	return names
}
