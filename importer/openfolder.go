package importer

import (
	"path"
	"sort"
	"strings"
)

type openSet struct {
	root         string
	data         map[string]any
	items        []document
	environments []document
}

func bundled(doc document) bool {
	_, hasItems := object(doc.data)["items"]
	return hasItems
}

func (c *collector) readOpenFolders(docs []document) {
	for _, set := range c.openSets(docs) {
		c.readOpenCollection(document{file: File{Name: set.root}, kind: kindOpenCollection, data: set.bundle()})
	}
}

func (c *collector) openSets(docs []document) []*openSet {
	var sets []*openSet
	var loose []document
	for _, doc := range docs {
		clean, ok := safeRelativePath(doc.file.Name)
		if !ok {
			c.skip(messageUnsafePath, doc.file.Name)
			continue
		}
		doc.file.Name = clean
		if doc.kind == kindOpenCollection {
			sets = append(sets, &openSet{root: path.Dir(clean), data: object(doc.data)})
			continue
		}
		loose = append(loose, doc)
	}
	sort.SliceStable(sets, func(i, j int) bool { return len(sets[i].root) > len(sets[j].root) })
	roots := make([]string, len(sets))
	for index, set := range sets {
		roots[index] = set.root
	}
	var implicit *openSet
	for _, doc := range loose {
		var set *openSet
		if index := owner(roots, doc.file.Name); index >= 0 {
			set = sets[index]
		} else {
			implicit = implicitOpenSet(implicit, loose)
			set = implicit
		}
		set.assign(doc)
	}
	if implicit != nil {
		sets = append(sets, implicit)
	}
	return sets
}

func implicitOpenSet(existing *openSet, docs []document) *openSet {
	if existing != nil {
		return existing
	}
	root := commonDirectory(docs)
	name := path.Base(root)
	if root == "." || root == "/" {
		name = collectionBundled
	}
	return &openSet{root: root, data: map[string]any{"info": map[string]any{"name": name}}}
}

func (set *openSet) assign(doc document) {
	relative := strings.TrimPrefix(strings.TrimPrefix(doc.file.Name, set.root), "/")
	if ignored(relative, object(object(set.data["extensions"])["bruno"])) {
		return
	}
	doc.file.Name = relative
	if doc.kind == kindOpenEnvironment {
		set.environments = append(set.environments, doc)
		return
	}
	set.items = append(set.items, doc)
}

func (set *openSet) bundle() map[string]any {
	bundle := map[string]any{}
	for key, value := range set.data {
		bundle[key] = value
	}
	bundle["items"] = []any{}
	folders := map[string]map[string]any{".": bundle}
	var folder func(dir string) map[string]any
	folder = func(dir string) map[string]any {
		if found, ok := folders[dir]; ok {
			return found
		}
		parent := folder(path.Dir(dir))
		created := map[string]any{"info": map[string]any{"name": path.Base(dir), "type": itemFolder}, "items": []any{}}
		folders[dir] = created
		parent["items"] = append(list(parent["items"]), created)
		return created
	}
	for _, doc := range set.items {
		data := object(doc.data)
		target := folder(path.Dir(doc.file.Name))
		if text(object(data["info"])["type"]) != itemFolder {
			target["items"] = append(list(target["items"]), data)
			continue
		}
		for key, value := range data {
			if key != "items" {
				target[key] = value
			}
		}
	}
	environments := make([]any, 0, len(set.environments))
	for _, doc := range set.environments {
		environments = append(environments, doc.data)
	}
	bundle["environments"] = environments
	return bundle
}
