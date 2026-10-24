package importer

import (
	"path"
	"sort"
	"strings"
)

const (
	protoExtension  = ".proto"
	maxProtoImports = 200
	protoImport     = "import"
)

type protoFile struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

func splitProtoFiles(files []File) ([]File, map[string]string) {
	kept := make([]File, 0, len(files))
	protos := map[string]string{}
	for _, file := range files {
		if strings.EqualFold(path.Ext(file.Name), protoExtension) {
			if clean, ok := safeRelativePath(file.Name); ok {
				protos[clean] = file.Text
			}
			continue
		}
		kept = append(kept, file)
	}
	return kept, protos
}

func (c *collector) protoSet(root, entry string) ([]protoFile, bool) {
	start, ok := safeRelativePath(path.Join(root, entry))
	if !ok {
		return nil, false
	}
	content, found := c.protos[start]
	if !found {
		return nil, false
	}
	files := []protoFile{{Name: path.Base(start), Content: content}}
	seen := map[string]bool{start: true}
	queue := []string{content}
	for len(queue) > 0 && len(files) < maxProtoImports {
		for _, imported := range protoImports(queue[0]) {
			location, known := c.protoNamed(root, imported)
			if !known || seen[location] {
				continue
			}
			seen[location] = true
			files = append(files, protoFile{Name: imported, Content: c.protos[location]})
			queue = append(queue, c.protos[location])
		}
		queue = queue[1:]
	}
	return files, true
}

func (c *collector) protoNamed(root, imported string) (string, bool) {
	var matches []string
	for location := range c.protos {
		relative := strings.TrimPrefix(strings.TrimPrefix(location, root), "/")
		if relative == imported || strings.HasSuffix(relative, "/"+imported) {
			matches = append(matches, location)
		}
	}
	sort.Slice(matches, func(i, j int) bool { return len(matches[i]) < len(matches[j]) })
	if len(matches) == 0 {
		return "", false
	}
	return matches[0], true
}

func protoImports(content string) []string {
	var imports []string
	for _, line := range strings.Split(normalizeNewlines(content), "\n") {
		rest, found := strings.CutPrefix(strings.TrimSpace(line), protoImport)
		if !found || rest == "" || !isSpaceByte(rest[0]) {
			continue
		}
		rest = strings.TrimSpace(rest)
		for _, modifier := range []string{"public ", "weak "} {
			rest = strings.TrimSpace(strings.TrimPrefix(rest, modifier))
		}
		if name, ok := quotedText(strings.TrimSuffix(rest, ";")); ok {
			imports = append(imports, name)
		}
	}
	return imports
}
