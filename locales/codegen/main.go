package main

import (
	"encoding/json"
	"fmt"
	"go/format"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode"
)

const (
	sourceGlob     = "en/*Messages.json"
	namespaceTrail = "Messages"
)

var pluralSuffixes = []string{"_zero", "_one", "_two", "_few", "_many", "_other"}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "locales/codegen:", err)
		os.Exit(1)
	}
}

func run() error {
	files, err := filepath.Glob(sourceGlob)
	if err != nil {
		return err
	}
	sort.Strings(files)
	for _, file := range files {
		if err := generate(file); err != nil {
			return err
		}
	}
	return nil
}

func generate(file string) error {
	data, err := os.ReadFile(file)
	if err != nil {
		return err
	}
	var tree map[string]any
	if err := json.Unmarshal(data, &tree); err != nil {
		return fmt.Errorf("%s: %w", file, err)
	}
	namespace := strings.TrimSuffix(filepath.Base(file), ".json")
	codes := map[string]string{}
	if err := collect(tree, nil, namespace, codes); err != nil {
		return fmt.Errorf("%s: %w", file, err)
	}
	return write(namespace, codes)
}

func collect(tree map[string]any, path []string, namespace string, codes map[string]string) error {
	for key, value := range tree {
		if nested, ok := value.(map[string]any); ok {
			if err := collect(nested, append(append([]string{}, path...), key), namespace, codes); err != nil {
				return err
			}
			continue
		}
		segments := append(append([]string{}, path...), withoutPluralSuffix(key))
		constant := constantName(namespace, segments)
		code := namespace + "." + strings.Join(segments, ".")
		if existing, taken := codes[constant]; taken && existing != code {
			return fmt.Errorf("%s and %s both become %s", existing, code, constant)
		}
		codes[constant] = code
	}
	return nil
}

func withoutPluralSuffix(key string) string {
	for _, suffix := range pluralSuffixes {
		if trimmed, found := strings.CutSuffix(key, suffix); found {
			return trimmed
		}
	}
	return key
}

func constantName(namespace string, segments []string) string {
	name := capitalize(strings.TrimSuffix(namespace, namespaceTrail))
	for _, segment := range segments {
		name += capitalize(segment)
	}
	return name
}

func capitalize(word string) string {
	runes := []rune(word)
	if len(runes) == 0 {
		return ""
	}
	runes[0] = unicode.ToUpper(runes[0])
	return string(runes)
}

func write(namespace string, codes map[string]string) error {
	names := make([]string, 0, len(codes))
	for name := range codes {
		names = append(names, name)
	}
	sort.Strings(names)
	var out strings.Builder
	out.WriteString("package locales\n\nconst (\n")
	for _, name := range names {
		fmt.Fprintf(&out, "\t%s Code = %q\n", name, codes[name])
	}
	out.WriteString(")\n")
	formatted, err := format.Source([]byte(out.String()))
	if err != nil {
		return err
	}
	stem := strings.TrimSuffix(namespace, namespaceTrail)
	return os.WriteFile("codes_"+strings.ToLower(stem)+".go", formatted, 0o644)
}
