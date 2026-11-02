package workspace

import (
	"errors"
	"fmt"
	"io/fs"
	"path"
	"sort"
	"strings"
)

const (
	SpecsDirectory   = "specs"
	SpecFormatYAML   = "yaml"
	SpecFormatJSON   = "json"
	specFallbackStem = "api"
	jsonExtension    = ".json"
)

var reservedDirectories = []string{FlowsDirectory, SpecsDirectory}

type Spec struct {
	Id     string `json:"id"`
	Name   string `json:"name"`
	Format string `json:"format"`
	Text   string `json:"text"`
}

func freeReservedDirectories(storage disk) map[string]bool {
	free := map[string]bool{}
	for _, directory := range reservedDirectories {
		free[directory] = !directoryHoldsRequests(storage, directory)
	}
	return free
}

func isReservedDirectory(directory, name string, reserved map[string]bool) bool {
	return directory == "" && reserved[strings.ToLower(name)]
}

func specFormatOf(name string) string {
	if strings.EqualFold(path.Ext(name), jsonExtension) {
		return SpecFormatJSON
	}
	return SpecFormatYAML
}

func isSpecFile(name string) bool {
	return isYAMLFile(name) || strings.EqualFold(path.Ext(name), jsonExtension)
}

func specExtension(format string) string {
	if format == SpecFormatJSON {
		return jsonExtension
	}
	return fileExtension
}

func (s *scanner) specFiles() {
	if !s.ahead.reserved[SpecsDirectory] {
		return
	}
	entries, err := s.disk.list(SpecsDirectory)
	if errors.Is(err, fs.ErrNotExist) {
		return
	}
	if err != nil {
		s.report(SpecsDirectory, err)
		return
	}
	for _, listed := range entries {
		name := listed.Name()
		if isHidden(name) || !listed.Type().IsRegular() || !isSpecFile(name) {
			continue
		}
		s.addSpec(joinPath(SpecsDirectory, name))
	}
}

func (s *scanner) addSpec(relative string) {
	content, err := s.disk.read(relative)
	if err != nil {
		s.report(relative, err)
		return
	}
	s.specs[relative] = Spec{Id: relative, Name: stemOf(relative), Format: specFormatOf(relative), Text: string(content)}
}

func (w *Workspace) orderedSpecs() []Spec {
	specs := make([]Spec, 0, len(w.specs))
	for _, spec := range w.specs {
		specs = append(specs, spec)
	}
	sort.Slice(specs, func(first, second int) bool {
		return strings.ToLower(specs[first].Id) < strings.ToLower(specs[second].Id)
	})
	return specs
}

func (w *Workspace) specPath(current Spec, known bool, spec Spec) (string, error) {
	extension := specExtension(spec.Format)
	if known && current.Format == spec.Format && sameStem(current.Name, spec.Name, specFallbackStem) {
		return current.Id, nil
	}
	taken := ""
	if known {
		taken = current.Id
	}
	return w.freePath(SpecsDirectory, fileStem(spec.Name, specFallbackStem), extension, taken)
}

func (w *Workspace) storeSpec(spec Spec) (Spec, error) {
	current, known := w.specs[spec.Id]
	target, err := w.specPath(current, known, spec)
	if err != nil {
		return Spec{}, err
	}
	if known {
		if err := w.relocate(current.Id, target); err != nil {
			return Spec{}, err
		}
		delete(w.specs, current.Id)
	}
	if err := w.disk.write(target, []byte(spec.Text)); err != nil {
		return Spec{}, err
	}
	stored := Spec{Id: target, Name: stemOf(target), Format: spec.Format, Text: spec.Text}
	w.specs[target] = stored
	return stored, nil
}

func (w *Workspace) dropSpecs(kept map[string]bool) error {
	for id := range w.specs {
		if kept[id] {
			continue
		}
		if err := w.disk.remove(id); err != nil {
			return err
		}
		delete(w.specs, id)
	}
	return nil
}

func validSpecFormat(format string) bool {
	return format == SpecFormatYAML || format == SpecFormatJSON
}

func (w *Workspace) SaveSpecs(specs []Spec) ([]Spec, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if directoryHoldsRequests(w.disk, SpecsDirectory) {
		return nil, errors.New("the specs folder of this workspace holds requests, so specs cannot be saved there; rename that folder first")
	}
	if len(specs) > 0 {
		if err := w.disk.makeDirectory(SpecsDirectory); err != nil {
			return nil, err
		}
	}
	saved := make([]Spec, 0, len(specs))
	kept := map[string]bool{}
	for _, spec := range specs {
		if !validSpecFormat(spec.Format) {
			return nil, fmt.Errorf("%s: the format must be yaml or json", spec.Name)
		}
		stored, err := w.storeSpec(spec)
		if err != nil {
			return nil, err
		}
		kept[stored.Id] = true
		saved = append(saved, stored)
	}
	return saved, w.dropSpecs(kept)
}
