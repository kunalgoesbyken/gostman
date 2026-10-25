package workspace

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	FlowsDirectory   = "flows"
	flowFallbackStem = "flow"
	flowIdPrefix     = "flow-"
)

var flowKeys = map[string]bool{"id": true, "name": true, "description": true, "maxSends": true, "steps": true}

type FlowCheck struct {
	Expression string `json:"expression" yaml:"expression"`
	Operator   string `json:"operator,omitempty" yaml:"operator,omitempty"`
	Value      string `json:"value,omitempty" yaml:"value,omitempty"`
	Enabled    *bool  `json:"enabled,omitempty" yaml:"enabled,omitempty"`
}

type FlowRetry struct {
	Times   int         `json:"times,omitempty" yaml:"times,omitempty"`
	DelayMs int64       `json:"delayMs,omitempty" yaml:"delayMs,omitempty"`
	Until   []FlowCheck `json:"until,omitempty" yaml:"until,omitempty"`
}

type FlowValue struct {
	Name   string `json:"name" yaml:"name"`
	Value  string `json:"value,omitempty" yaml:"value,omitempty"`
	Step   string `json:"step,omitempty" yaml:"step,omitempty"`
	Source string `json:"source,omitempty" yaml:"source,omitempty"`
	Path   string `json:"path,omitempty" yaml:"path,omitempty"`
}

type FlowStep struct {
	Id         string            `json:"id" yaml:"id"`
	Kind       string            `json:"kind" yaml:"kind"`
	Label      string            `json:"label,omitempty" yaml:"label,omitempty"`
	Request    string            `json:"request,omitempty" yaml:"request,omitempty"`
	RequestId  string            `json:"requestId,omitempty" yaml:"requestId,omitempty"`
	Variables  map[string]string `json:"variables,omitempty" yaml:"variables,omitempty"`
	Retry      *FlowRetry        `json:"retry,omitempty" yaml:"retry,omitempty"`
	OnFailure  string            `json:"onFailure,omitempty" yaml:"onFailure,omitempty"`
	Values     []FlowValue       `json:"values,omitempty" yaml:"values,omitempty"`
	Source     string            `json:"source,omitempty" yaml:"source,omitempty"`
	Step       string            `json:"step,omitempty" yaml:"step,omitempty"`
	Path       string            `json:"path,omitempty" yaml:"path,omitempty"`
	As         string            `json:"as,omitempty" yaml:"as,omitempty"`
	IndexAs    string            `json:"indexAs,omitempty" yaml:"indexAs,omitempty"`
	Match      string            `json:"match,omitempty" yaml:"match,omitempty"`
	Conditions []FlowCheck       `json:"conditions,omitempty" yaml:"conditions,omitempty"`
	Then       string            `json:"then,omitempty" yaml:"then,omitempty"`
	Else       string            `json:"else,omitempty" yaml:"else,omitempty"`
	Steps      []FlowStep        `json:"steps,omitempty" yaml:"steps,omitempty"`
	Ms         *int64            `json:"ms,omitempty" yaml:"ms,omitempty"`
	Outcome    string            `json:"outcome,omitempty" yaml:"outcome,omitempty"`
	Message    string            `json:"message,omitempty" yaml:"message,omitempty"`
	Next       string            `json:"next,omitempty" yaml:"next,omitempty"`
}

type Flow struct {
	Id          string     `json:"id" yaml:"id"`
	Name        string     `json:"name" yaml:"name"`
	Description string     `json:"description,omitempty" yaml:"description,omitempty"`
	MaxSends    int        `json:"maxSends,omitempty" yaml:"maxSends,omitempty"`
	Steps       []FlowStep `json:"steps" yaml:"steps"`
}

type flowEntry struct {
	flow   Flow
	path   string
	extras []*yaml.Node
}

func IsFlowFile(relative string) bool {
	return strings.HasPrefix(strings.ToLower(relative), FlowsDirectory+"/")
}

func flowsHoldRequests(storage disk) bool {
	entries, err := storage.list(FlowsDirectory)
	if err != nil {
		return false
	}
	for _, entry := range entries {
		if holdsRequests(storage, entry) {
			return true
		}
	}
	return false
}

func holdsRequests(storage disk, entry fs.DirEntry) bool {
	name := entry.Name()
	switch {
	case isHidden(name):
		return false
	case entry.IsDir() || strings.EqualFold(name, FolderFileName):
		return true
	case !entry.Type().IsRegular() || !isYAMLFile(name):
		return false
	}
	content, err := storage.read(joinPath(FlowsDirectory, name))
	if err != nil {
		return false
	}
	root, err := parseDocument(content)
	return err == nil && isRequestDocument(root) && !hasStepsKey(root)
}

func hasStepsKey(root *yaml.Node) bool {
	for index := 0; index+1 < len(root.Content); index += 2 {
		if root.Content[index].Value == "steps" {
			return true
		}
	}
	return false
}

func isFlowsDirectory(directory, name string, reserved bool) bool {
	return reserved && directory == "" && strings.EqualFold(name, FlowsDirectory)
}

func readFlow(root *yaml.Node) (flowEntry, error) {
	var entry flowEntry
	if err := root.Decode(&entry.flow); err != nil {
		return entry, &fileError{line: root.Line, message: strings.TrimPrefix(err.Error(), "yaml: ")}
	}
	for index := 0; index+1 < len(root.Content); index += 2 {
		if !flowKeys[root.Content[index].Value] {
			entry.extras = append(entry.extras, root.Content[index], root.Content[index+1])
		}
	}
	if entry.flow.Steps == nil {
		entry.flow.Steps = []FlowStep{}
	}
	return entry, nil
}

func encodeFlow(entry flowEntry) ([]byte, error) {
	var root yaml.Node
	if err := root.Encode(entry.flow); err != nil {
		return nil, err
	}
	root.Content = append(root.Content, entry.extras...)
	return encodeDocument(&root)
}

func (s *scanner) flowFiles() {
	if !s.ahead.flowsReserved {
		return
	}
	entries, err := s.disk.list(FlowsDirectory)
	if errors.Is(err, fs.ErrNotExist) {
		return
	}
	if err != nil {
		s.report(FlowsDirectory, err)
		return
	}
	for _, listed := range entries {
		name := listed.Name()
		if isHidden(name) || !listed.Type().IsRegular() || !isYAMLFile(name) {
			continue
		}
		s.addFlow(joinPath(FlowsDirectory, name))
	}
}

func (s *scanner) addFlow(relative string) {
	content, err := s.disk.read(relative)
	entry, err := decodeFile(content, err, readFlow)
	if err != nil {
		s.report(relative, err)
		return
	}
	entry.path = relative
	if strings.TrimSpace(entry.flow.Name) == "" {
		entry.flow.Name = stemOf(relative)
	}
	entry.flow.Id = uniqueId(entry.flow.Id, flowIdPrefix, relative, func(id string) bool { return s.flows[id] != nil })
	s.flows[entry.flow.Id] = &entry
}

func (w *Workspace) orderedFlows() []Flow {
	entries := make([]*flowEntry, 0, len(w.flows))
	for _, entry := range w.flows {
		entries = append(entries, entry)
	}
	sort.Slice(entries, func(first, second int) bool {
		firstName, secondName := strings.ToLower(entries[first].flow.Name), strings.ToLower(entries[second].flow.Name)
		if firstName != secondName {
			return firstName < secondName
		}
		return entries[first].path < entries[second].path
	})
	flows := make([]Flow, len(entries))
	for index, entry := range entries {
		flows[index] = entry.flow
	}
	return flows
}

func (w *Workspace) flowPath(entry *flowEntry, flow Flow) (string, error) {
	if entry.path != "" && sameStem(entry.flow.Name, flow.Name, flowFallbackStem) {
		return entry.path, nil
	}
	return w.freePath(FlowsDirectory, fileStem(flow.Name, flowFallbackStem), fileExtension, entry.path)
}

func (w *Workspace) storeFlow(flow Flow) error {
	if flow.Id == "" {
		return errMissingId
	}
	entry := w.flows[flow.Id]
	if entry == nil {
		entry = &flowEntry{}
	}
	target, err := w.flowPath(entry, flow)
	if err != nil {
		return err
	}
	isStored := entry.path == target && reflect.DeepEqual(entry.flow, flow)
	if entry.path != "" {
		if err := w.relocate(entry.path, target); err != nil {
			return err
		}
		entry.path = target
	}
	if isStored {
		return nil
	}
	content, err := encodeFlow(flowEntry{flow: flow, extras: entry.extras})
	if err != nil {
		return fmt.Errorf("%s: %w", flow.Name, err)
	}
	if err := w.disk.write(target, content); err != nil {
		return err
	}
	entry.flow, entry.path = flow, target
	w.flows[flow.Id] = entry
	return nil
}

func (w *Workspace) dropFlows(kept map[string]bool) error {
	for id, entry := range w.flows {
		if kept[id] {
			continue
		}
		if err := w.disk.remove(entry.path); err != nil {
			return err
		}
		delete(w.flows, id)
	}
	return nil
}

func (w *Workspace) SaveFlows(flows []Flow) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if flowsHoldRequests(w.disk) {
		return errors.New("the flows folder of this workspace holds requests, so flows cannot be saved there; rename that folder first")
	}
	if len(flows) > 0 {
		if err := w.disk.makeDirectory(FlowsDirectory); err != nil {
			return err
		}
	}
	kept := map[string]bool{}
	for _, flow := range flows {
		kept[flow.Id] = true
		if err := w.storeFlow(flow); err != nil {
			return err
		}
	}
	return w.dropFlows(kept)
}

func ReadFlowFile(path string) (Flow, error) {
	content, err := os.ReadFile(path)
	entry, err := decodeFile(content, err, readFlow)
	if err != nil {
		return Flow{}, fmt.Errorf("%s: %w", path, err)
	}
	if strings.TrimSpace(entry.flow.Name) == "" {
		entry.flow.Name = stemOf(filepath.ToSlash(path))
	}
	if entry.flow.Id == "" {
		entry.flow.Id = derivedId(flowIdPrefix, filepath.ToSlash(path), 0)
	}
	return entry.flow, nil
}
