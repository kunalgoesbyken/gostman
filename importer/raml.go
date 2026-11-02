package importer

import (
	"encoding/json"
	"path"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/locales"
	"gopkg.in/yaml.v3"
)

const (
	ramlHeader      = "#%RAML"
	ramlBaseURL     = "baseUrl"
	ramlBasicScheme = "basic authentication"
)

var ramlMethods = setOf("get", "post", "put", "delete", "patch", "head", "options", "trace")

type ramlPair struct {
	key   string
	value *yaml.Node
}

func looksLikeRAML(source string) bool {
	return strings.HasPrefix(source, ramlHeader)
}

func ramlPairs(node *yaml.Node) []ramlPair {
	if node == nil || node.Kind != yaml.MappingNode {
		return nil
	}
	pairs := make([]ramlPair, 0, len(node.Content)/2)
	for index := 0; index+1 < len(node.Content); index += 2 {
		pairs = append(pairs, ramlPair{key: node.Content[index].Value, value: node.Content[index+1]})
	}
	return pairs
}

func ramlField(node *yaml.Node, key string) *yaml.Node {
	for _, pair := range ramlPairs(node) {
		if pair.key == key {
			return pair.value
		}
	}
	return nil
}

func ramlValue(node *yaml.Node) any {
	if node == nil {
		return nil
	}
	var value any
	if node.Decode(&value) != nil {
		return nil
	}
	return value
}

func ramlText(node *yaml.Node) string {
	if node == nil || node.Kind != yaml.ScalarNode {
		return ""
	}
	return node.Value
}

func (c *collector) readRAML(doc document) {
	var parsed yaml.Node
	if err := yaml.Unmarshal([]byte(doc.file.Text), &parsed); err != nil || len(parsed.Content) == 0 {
		c.skip(locales.ImporterSkipFileError, locales.Params{"file": doc.file.Name, "detail": "not valid RAML"})
		return
	}
	root := parsed.Content[0]
	title := cleanName(ramlText(ramlField(root, "title")), strings.TrimSuffix(doc.file.Name, path.Ext(doc.file.Name)))
	c.read(title, FormatRAML, func() {
		c.lead(locales.New(locales.ImporterRamlScope, locales.Params{"name": title}))
		base := strings.ReplaceAll(ramlText(ramlField(root, "baseUri")), "{version}", ramlText(ramlField(root, "version")))
		settings := scope{vars: []row{{Key: ramlBaseURL, Value: base, Enabled: true}}}
		rootID := c.addScopedFolder(title, "", c.collectionScope(settings))
		folders := map[string]string{}
		schemes := ramlField(root, "securitySchemes")
		for _, pair := range ramlPairs(root) {
			if strings.HasPrefix(pair.key, "/") {
				c.ramlResource(pair, "", rootID, folders, root, schemes)
			}
		}
	})
}

func (c *collector) ramlResource(resource ramlPair, parentPath, rootID string, folders map[string]string, api, schemes *yaml.Node) {
	fullPath := parentPath + resource.key
	folderID := rootID
	if segment := firstSegment(fullPath); segment != "" {
		if id, known := folders[segment]; known {
			folderID = id
		} else {
			folderID = c.addFolder(segment, rootID)
			folders[segment] = folderID
		}
	}
	for _, pair := range ramlPairs(resource.value) {
		method := strings.TrimSuffix(strings.ToLower(pair.key), "?")
		switch {
		case ramlMethods[method]:
			c.ramlRequest(strings.ToUpper(method), fullPath, pair.value, folderID, api, schemes)
		case strings.HasPrefix(pair.key, "/"):
			c.ramlResource(pair, fullPath, rootID, folders, api, schemes)
		}
	}
}

func firstSegment(resourcePath string) string {
	for _, segment := range strings.Split(resourcePath, "/") {
		if segment != "" && !strings.HasPrefix(segment, "{") {
			return segment
		}
	}
	return ""
}

func ramlParameters(node *yaml.Node, defaults bool) []row {
	var rows []row
	for _, pair := range ramlPairs(node) {
		details := pair.value
		example := firstValue(ramlValue(ramlField(details, "example")), ramlValue(ramlField(details, "default")))
		required := ramlText(ramlField(details, "required")) == "true"
		rows = append(rows, row{Key: strings.TrimSuffix(pair.key, "?"), Value: example, Enabled: required || example != "" || defaults})
	}
	return keyedRows(rows)
}

func (c *collector) ramlRequest(method, resourcePath string, node *yaml.Node, folderID string, api, schemes *yaml.Node) {
	address := "{{" + ramlBaseURL + "}}" + strings.NewReplacer("{", "{{", "}", "}}").Replace(resourcePath)
	name := cleanName(ramlText(ramlField(node, "displayName")), method+" "+resourcePath)
	request := parts{
		name:        name,
		method:      method,
		url:         address,
		description: ramlText(ramlField(node, "description")),
		params:      ramlParameters(ramlField(node, "queryParameters"), false),
		headers:     ramlParameters(ramlField(node, "headers"), true),
	}
	request.auth = c.ramlAuth(node, api, schemes, name)
	c.ramlBody(&request, ramlField(node, "body"), ramlText(ramlField(api, "mediaType")))
	c.build(request, folderID)
}

func (c *collector) ramlAuth(node, api, schemes *yaml.Node, name string) *engine.Auth {
	secured := ramlField(node, "securedBy")
	if secured == nil {
		secured = ramlField(api, "securedBy")
	}
	if secured == nil || secured.Kind != yaml.SequenceNode || len(secured.Content) == 0 || secured.Content[0].Kind != yaml.ScalarNode {
		return nil
	}
	if secured.Content[0].Value == "null" {
		return noAuth()
	}
	scheme := ramlField(schemes, secured.Content[0].Value)
	if strings.ToLower(ramlText(ramlField(scheme, "type"))) == ramlBasicScheme {
		auth := credentialsAuth(authBasic, "{{username}}", "{{password}}")
		return &auth
	}
	c.flagUnique(locales.ImporterAuthDropped, name)
	return nil
}

func (c *collector) ramlBody(request *parts, body *yaml.Node, defaultType string) {
	contentType, details := defaultType, body
	if pairs := ramlPairs(body); len(pairs) > 0 && strings.Contains(pairs[0].key, "/") {
		contentType, details = pairs[0].key, pairs[0].value
	}
	example := ramlField(details, "example")
	if example == nil {
		return
	}
	text := ramlText(example)
	if example.Kind != yaml.ScalarNode {
		encoded, err := json.MarshalIndent(ramlValue(example), "", "  ")
		if err != nil {
			return
		}
		text = string(encoded)
	}
	request.body, request.bodyType = text, bodyTypeOfMime(contentType)
	if contentType == "" {
		request.bodyType = bodyJSON
		if !strings.HasPrefix(strings.TrimSpace(text), "{") && !strings.HasPrefix(strings.TrimSpace(text), "[") {
			request.bodyType = bodyText
		}
	}
	if request.bodyType == bodyForm || request.bodyType == bodyMultipart {
		request.bodyType, request.body = bodyText, text
	}
}
