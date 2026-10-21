package secrets

import (
	"errors"
	"fmt"
	"strings"
	"unicode"
)

type Ref struct {
	Provider string `json:"provider"`
	Path     string `json:"path"`
	Field    string `json:"field,omitempty"`
	Version  string `json:"version,omitempty"`
}

func (r Ref) Describe() string {
	if r.Field == "" {
		return fmt.Sprintf("%q from %q", r.Path, r.Provider)
	}
	return fmt.Sprintf("%q field %q from %q", r.Path, r.Field, r.Provider)
}

func (r Ref) Validate() error {
	if strings.TrimSpace(r.Provider) == "" || strings.TrimSpace(r.Path) == "" {
		return errors.New("a secret reference needs a connection and a path")
	}
	for _, segment := range strings.Split(r.Path, "/") {
		if segment == "." || segment == ".." {
			return fmt.Errorf("the path %q may not contain . or .. segments", r.Path)
		}
	}
	if strings.IndexFunc(r.Path+r.Field+r.Version, unicode.IsControl) >= 0 {
		return errors.New("a secret reference may not contain control characters")
	}
	if strings.ContainsAny(r.Version, "/\\") {
		return fmt.Errorf("the version %q may not contain slashes", r.Version)
	}
	return nil
}

func (r Ref) segments() []string {
	var segments []string
	for _, segment := range strings.Split(r.Path, "/") {
		if segment != "" {
			segments = append(segments, segment)
		}
	}
	return segments
}
