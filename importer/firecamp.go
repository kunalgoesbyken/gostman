package importer

import (
	"slices"
	"strings"

	"github.com/kunalgoesbyken/gostman/locales"
)

const (
	FormatFirecamp = "firecamp"

	firecampRestType = "rest"
	firecampNoAuth   = "none"
	firecampNoBody   = "none"
)

func firecampKind(root map[string]any) bool {
	collection := object(root["collection"])
	return collection != nil && object(collection["__ref"]) != nil && list(root["requests"]) != nil && list(root["folders"]) != nil
}

func firecampID(item map[string]any) string {
	return text(object(item["__ref"])["id"])
}

func firecampParent(item map[string]any) string {
	return text(object(item["__ref"])["folderId"])
}

func firecampOrders(item map[string]any, key string) []string {
	return texts(object(item["__meta"])[key])
}

func firecampOrdered(items []map[string]any, order []string) []map[string]any {
	position := func(item map[string]any) int {
		index := slices.Index(order, firecampID(item))
		if index < 0 {
			return len(order)
		}
		return index
	}
	ordered := slices.Clone(items)
	slices.SortStableFunc(ordered, func(first, second map[string]any) int { return position(first) - position(second) })
	return ordered
}

func (c *collector) readFirecamp(doc document) {
	root := object(doc.data)
	collection := object(root["collection"])
	name := cleanName(text(collection["name"]), strings.TrimSuffix(doc.file.Name, ".json"))
	c.read(name, FormatFirecamp, func() {
		rootID := c.addFolder(name, "")
		folderSources := objects(root["folders"])
		folders := c.firecampFolders(collection, folderSources, rootID)
		for _, request := range firecampRequests(collection, folderSources, objects(root["requests"])) {
			parent, known := folders[firecampParent(request)]
			if !known {
				parent = rootID
			}
			c.firecampRequest(request, parent)
		}
	})
}

func (c *collector) firecampFolders(collection map[string]any, sources []map[string]any, rootID string) map[string]string {
	folders := map[string]string{"": rootID, firecampID(collection): rootID}
	pending := firecampOrdered(sources, firecampOrders(collection, "fOrders"))
	for round := 0; round < maxFolderDepth && len(pending) > 0; round++ {
		var later []map[string]any
		for _, folder := range pending {
			parent, known := folders[firecampParent(folder)]
			if !known {
				later = append(later, folder)
				continue
			}
			folders[firecampID(folder)] = c.addScopedFolder(text(folder["name"]), parent, scope{description: text(folder["description"])})
		}
		pending = later
	}
	if len(pending) > 0 {
		c.warnDepth()
	}
	return folders
}

func firecampRequests(collection map[string]any, folders, requests []map[string]any) []map[string]any {
	holders := append([]map[string]any{collection}, folders...)
	var ordered []map[string]any
	for _, holder := range holders {
		var inside []map[string]any
		for _, request := range requests {
			if parent := firecampParent(request); parent == firecampID(holder) || parent == "" && firecampID(holder) == firecampID(collection) {
				inside = append(inside, request)
			}
		}
		ordered = append(ordered, firecampOrdered(inside, firecampOrders(holder, "rOrders"))...)
	}
	return append(ordered, orphanRequests(ordered, requests)...)
}

func orphanRequests(placed, requests []map[string]any) []map[string]any {
	var orphans []map[string]any
	for _, request := range requests {
		if !slices.ContainsFunc(placed, func(item map[string]any) bool { return firecampID(item) == firecampID(request) }) {
			orphans = append(orphans, request)
		}
	}
	return orphans
}

func firecampRows(value any) []row {
	return fieldRows(value, "key", "value", func(item map[string]any) bool { return item["disable"] != true })
}

func firecampScript(value any) string {
	var scripts []string
	for _, script := range objects(value) {
		if body := strings.TrimSpace(strings.Join(texts(script["value"]), "\n")); body != "" {
			scripts = append(scripts, body)
		}
	}
	return strings.Join(scripts, "\n")
}

func (c *collector) firecampRequest(source map[string]any, folderID string) {
	meta := object(source["__meta"])
	address := object(source["url"])
	name := cleanName(text(meta["name"]), text(source["method"])+" "+text(address["raw"]))
	if kind := firstOf(text(meta["type"]), firecampRestType); kind != firecampRestType {
		c.skip(locales.ImporterFirecampType, locales.Params{"name": name, "type": kind})
		return
	}
	request := parts{
		name:        name,
		method:      text(source["method"]),
		url:         text(address["raw"]),
		description: text(meta["description"]),
		headers:     firecampRows(source["headers"]),
		preScript:   firecampScript(source["preScripts"]),
		postScript:  firecampScript(source["postScripts"]),
	}
	if kind := text(object(source["auth"])["type"]); kind != "" && kind != firecampNoAuth {
		c.flagUnique(locales.ImporterAuthDropped, name)
	}
	c.firecampBody(&request, object(source["body"]))
	c.build(request, folderID)
}

func (c *collector) firecampBody(request *parts, body map[string]any) {
	kind := text(body["type"])
	if kind == "" || kind == firecampNoBody {
		return
	}
	content, isText := body["value"].(string)
	bodyType := bodyTypeOfMime(kind)
	supported := strings.Contains(kind, "/") && isText && (bodyType == bodyJSON || bodyType == bodyXML || bodyType == bodyText)
	if !supported {
		c.flag(locales.ImporterForeignBodies, request.name)
		return
	}
	request.bodyType, request.body = bodyType, content
}
