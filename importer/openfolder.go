package importer

import (
	"path"
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
	for _, set := range openSets(c.readWorkspaceEnvironments(c.safeDocuments(docs))) {
		c.readOpenTree(document{file: File{Name: set.root}, kind: kindOpenCollection, data: set.bundle()}, set.root)
	}
}

func isOpenWorkspace(doc document) bool {
	return (doc.kind == kindOpenItem || doc.kind == kindOpenCollection) && text(object(object(doc.data)["info"])["type"]) == itemWorkspace
}

func (c *collector) readWorkspaceEnvironments(docs []document) []document {
	folders := map[string]string{}
	for _, doc := range docs {
		if isOpenWorkspace(doc) {
			folders[path.Join(path.Dir(doc.file.Name), brunoEnvironmentsFolder)] = cleanName(text(object(object(doc.data)["info"])["name"]), collectionBundled)
		}
	}
	if len(folders) == 0 {
		return docs
	}
	kept := make([]document, 0, len(docs))
	drafts := map[string][]environmentDraft{}
	for _, doc := range docs {
		workspace, global := folders[path.Dir(doc.file.Name)]
		switch {
		case isOpenWorkspace(doc):
		case global && doc.kind == kindOpenEnvironment:
			draft := openEnvironment(object(doc.data), fileStem(doc.file.Name))
			draft.global = true
			drafts[workspace] = append(drafts[workspace], draft)
		default:
			kept = append(kept, doc)
		}
	}
	for _, workspace := range sortedKeys(drafts) {
		c.read(workspace, FormatBruno, func() { c.addDraftEnvironments(drafts[workspace]) })
	}
	return kept
}

func openSets(docs []document) []*openSet {
	var sets []*openSet
	for _, group := range groupByRoot(docs, kindOpenCollection, collectionBundled) {
		set := &openSet{root: group.root, data: object(group.head.data)}
		if group.head.kind != kindOpenCollection {
			set.data = map[string]any{"info": map[string]any{"name": group.name}}
		}
		for _, doc := range group.docs {
			set.assign(doc)
		}
		sets = append(sets, set)
	}
	return sets
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
