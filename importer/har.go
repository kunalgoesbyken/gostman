package importer

import (
	"net/url"
	"strings"
)

var staticMimePrefixes = []string{"image/", "font/", "audio/", "video/", "text/css", "text/javascript", "application/javascript", "application/x-javascript", "application/font", "application/x-font", "application/vnd.ms-fontobject", "application/wasm", "application/x-shockwave-flash"}

var ignoredHARHeaders = map[string]bool{
	"host": true, "content-length": true, "connection": true, "cookie": true, "proxy-connection": true, "keep-alive": true, "transfer-encoding": true,
}

type Options struct {
	SkipStatic bool `json:"skipStatic"`
}

func (c *collector) readHAR(doc document, options Options) {
	root := object(object(doc.data)["log"])
	name := cleanName(strings.TrimSuffix(doc.file.Name, ".har"), "HAR")
	c.read(name, FormatHAR, func() {
		rootID := c.addFolder(name, "")
		hosts := map[string]string{}
		seen := map[string]bool{}
		duplicates, assets := 0, 0
		for _, entry := range objects(root["entries"]) {
			source := object(entry["request"])
			if source == nil {
				continue
			}
			if options.SkipStatic && isStaticAsset(object(object(entry["response"])["content"])) {
				assets++
				continue
			}
			identity := entryIdentity(source)
			if seen[identity] {
				duplicates++
				continue
			}
			seen[identity] = true
			c.harRequest(source, rootID, hosts)
		}
		c.noteSkipped(duplicates, "duplicate requests")
		c.noteSkipped(assets, "static assets")
	})
}

func (c *collector) noteSkipped(count int, what string) {
	if count > 0 {
		c.skip("%d %s were left out", count, what)
	}
}

func isStaticAsset(content map[string]any) bool {
	mime := strings.ToLower(text(content["mimeType"]))
	for _, prefix := range staticMimePrefixes {
		if strings.HasPrefix(mime, prefix) {
			return true
		}
	}
	return false
}

func entryIdentity(source map[string]any) string {
	return text(source["method"]) + " " + text(source["url"]) + "\n" + text(object(source["postData"])["text"])
}

func (c *collector) harRequest(source map[string]any, rootID string, hosts map[string]string) {
	address := text(source["url"])
	parsed, err := url.Parse(address)
	if err != nil || parsed.Host == "" {
		c.skip("%q is not an address that can be requested", address)
		return
	}
	folderID, known := hosts[parsed.Host]
	if !known {
		folderID = c.addFolder(parsed.Host, rootID)
		hosts[parsed.Host] = folderID
	}
	headers := harHeaders(source["headers"])
	request := parts{
		name:        text(source["method"]) + " " + requestTarget(parsed),
		method:      text(source["method"]),
		url:         address,
		headers:     headers,
		description: cookieNote(source["cookies"]),
	}
	harBody(object(source["postData"]), &request)
	c.build(request, scope{}, folderID)
}

func requestTarget(parsed *url.URL) string {
	if parsed.Path == "" || parsed.Path == "/" {
		return parsed.Host
	}
	return parsed.Path
}

func harHeaders(value any) []row {
	var rows []row
	for _, entry := range objects(value) {
		name := text(entry["name"])
		if strings.HasPrefix(name, ":") || ignoredHARHeaders[strings.ToLower(name)] {
			continue
		}
		rows = append(rows, row{Key: name, Value: text(entry["value"]), Enabled: true})
	}
	return keyedRows(rows)
}

func cookieNote(value any) string {
	var names []string
	for _, entry := range objects(value) {
		names = append(names, text(entry["name"]))
	}
	if len(names) == 0 {
		return ""
	}
	return "Cookies sent in the capture (values not imported): " + strings.Join(names, ", ")
}

func harBody(post map[string]any, request *parts) {
	if post == nil {
		return
	}
	mime := text(post["mimeType"])
	bodyType := bodyTypeOfMime(mime)
	params := harParams(post["params"], bodyType)
	switch {
	case len(params) > 0 && (bodyType == bodyForm || bodyType == bodyMultipart):
		request.body, request.bodyType = rowsJSON(params), bodyType
		request.needsFiles = anyFile(params)
	case text(post["text"]) != "":
		request.body, request.bodyType = text(post["text"]), bodyType
	}
}

func harParams(value any, bodyType string) []row {
	var rows []row
	for _, entry := range objects(value) {
		candidate := row{Key: text(entry["name"]), Value: text(entry["value"]), Enabled: true}
		if bodyType == bodyMultipart {
			candidate.Type = rowTypeText
			if fileName := text(entry["fileName"]); fileName != "" {
				candidate = row{Key: candidate.Key, Enabled: true, Type: rowTypeFile, FileName: baseName(fileName), ContentType: text(entry["contentType"])}
			}
		}
		rows = append(rows, candidate)
	}
	return keyedRows(rows)
}
