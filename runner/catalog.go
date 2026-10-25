package runner

import (
	"fmt"
	"strings"
)

type Listed struct {
	Request   Request
	Folder    string
	Checks    int
	Arguments map[string]string
}

func (l Listed) QualifiedName() string {
	if l.Folder == "" {
		return l.Request.Name
	}
	return l.Folder + pathSeparator + l.Request.Name
}

func (s *Session) Catalog(stored Collection, folder string) ([]Listed, error) {
	planned, err := prepare(s.state.scripts, stored, Options{Folder: folder})
	if err != nil {
		return nil, err
	}
	listed := make([]Listed, 0, len(planned.requests))
	for _, request := range planned.requests {
		var checks int
		if err := s.state.scripts.Call("countActiveAssertions", &checks, request.Assertions); err != nil {
			return nil, err
		}
		listed = append(listed, Listed{Request: request, Folder: planned.folderNames[request.FolderID], Checks: checks})
	}
	return listed, nil
}

func filterListed(listed []Listed, matches func(Listed) bool) []Listed {
	var kept []Listed
	for _, candidate := range listed {
		if matches(candidate) {
			kept = append(kept, candidate)
		}
	}
	return kept
}

func describeListed(listed []Listed) string {
	names := make([]string, 0, len(listed))
	for _, candidate := range listed {
		names = append(names, fmt.Sprintf("%s (id %s)", candidate.QualifiedName(), candidate.Request.ID))
	}
	return strings.Join(names, ", ")
}

func referenceMatchers(reference string) []func(Listed) bool {
	return []func(Listed) bool{
		func(candidate Listed) bool { return candidate.Request.ID == reference },
		func(candidate Listed) bool { return candidate.QualifiedName() == reference },
		func(candidate Listed) bool { return candidate.Request.Name == reference },
		func(candidate Listed) bool { return strings.EqualFold(candidate.Request.Name, reference) },
	}
}

func (s *Session) Find(stored Collection, reference string) (Listed, error) {
	listed, err := s.Catalog(stored, "")
	if err != nil {
		return Listed{}, err
	}
	for _, matches := range referenceMatchers(reference) {
		found := filterListed(listed, matches)
		if len(found) == 1 {
			return found[0], nil
		}
		if len(found) > 1 {
			return Listed{}, fmt.Errorf("%q matches several requests (%s); use an id", reference, describeListed(found))
		}
	}
	return Listed{}, notFound(listed, reference)
}

func notFound(listed []Listed, reference string) error {
	name := reference[strings.LastIndex(reference, pathSeparator)+len(pathSeparator):]
	named := filterListed(listed, func(candidate Listed) bool { return strings.EqualFold(candidate.Request.Name, strings.TrimSpace(name)) })
	if len(named) > 0 {
		return fmt.Errorf("there is no request with the id or name %q; requests named %q: %s", reference, name, describeListed(named))
	}
	return fmt.Errorf("there is no request with the id or name %q", reference)
}
