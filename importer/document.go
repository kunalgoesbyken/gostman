package importer

import (
	"encoding/json"
	"encoding/xml"
	"path"
	"strings"

	"github.com/kunalgoesbyken/gostman/locales"
	"gopkg.in/yaml.v3"
)

const (
	FormatAuto     = "auto"
	FormatInsomnia = "insomnia"
	FormatHAR      = "har"
	FormatWSDL     = "wsdl"
	FormatBruno    = "bruno"
	FormatPostman  = "postman"
	FormatOpenAPI  = "openapi"
	FormatGostman  = "gostman"
	FormatHTTP     = "http"

	kindInsomnia            = "insomnia"
	kindHAR                 = "har"
	kindWSDL                = "wsdl"
	kindSchema              = "schema"
	kindPostmanCollection   = "postman-collection"
	kindPostmanEnvironment  = "postman-environment"
	kindPostmanDump         = "postman-dump"
	kindOpenAPI             = "openapi"
	kindBruno               = "bruno"
	kindBrunoConfig         = "bruno-config"
	kindOpenCollection      = "opencollection"
	kindOpenItem            = "opencollection-item"
	kindOpenEnvironment     = "opencollection-environment"
	kindBrunoEnvironment    = "bruno-environment"
	kindGostman             = "gostman"
	kindHTTP                = "http"
	kindHTTPEnvironment     = "http-environment"
	kindUnknown             = ""
	postmanSchemaMarker     = "getpostman.com/json/collection"
	insomniaExportType      = "export"
	wsdlNamespace           = "http://schemas.xmlsoap.org/wsdl/"
	wsdl2Namespace          = "http://www.w3.org/ns/wsdl"
	schemaNamespace         = "http://www.w3.org/2001/XMLSchema"
	brunoCollectionFile     = "collection.bru"
	brunoFolderFile         = "folder.bru"
	brunoEnvironmentsFolder = "environments"
	brunoExtension          = ".bru"
)

var importableExtensions = map[string]bool{".json": true, ".yml": true, ".yaml": true, ".xml": true, ".wsdl": true, ".xsd": true, ".har": true, ".txt": true, httpExtension: true, restExtension: true}

var kindFormats = map[string]string{
	kindInsomnia:           FormatInsomnia,
	kindHAR:                FormatHAR,
	kindWSDL:               FormatWSDL,
	kindSchema:             FormatWSDL,
	kindPostmanCollection:  FormatPostman,
	kindPostmanEnvironment: FormatPostman,
	kindPostmanDump:        FormatPostman,
	kindOpenAPI:            FormatOpenAPI,
	kindBruno:              FormatBruno,
	kindBrunoConfig:        FormatBruno,
	kindOpenCollection:     FormatBruno,
	kindOpenItem:           FormatBruno,
	kindOpenEnvironment:    FormatBruno,
	kindBrunoEnvironment:   FormatBruno,
	kindGostman:            FormatGostman,
	kindHTTP:               FormatHTTP,
	kindHTTPEnvironment:    FormatHTTP,
}

type document struct {
	file File
	kind string
	data any
	err  error
}

func decodeStructured(source string) (any, error) {
	trimmed := strings.TrimSpace(source)
	if trimmed == "" {
		return nil, errEmpty
	}
	if trimmed[0] == '{' || trimmed[0] == '[' {
		decoder := json.NewDecoder(strings.NewReader(trimmed))
		decoder.UseNumber()
		var value any
		if err := decoder.Decode(&value); err != nil {
			return nil, err
		}
		return value, nil
	}
	var value any
	if err := yaml.Unmarshal([]byte(trimmed), &value); err != nil {
		return nil, err
	}
	return value, nil
}

func classify(file File) document {
	doc := document{file: file}
	trimmed := strings.TrimSpace(file.Text)
	switch {
	case !importableName(file.Name):
		doc.err = unsupportedType(file.Name)
	case trimmed == "":
		doc.err = errEmpty
	case isHTTPFileName(file.Name):
		doc.kind = kindHTTP
	case strings.HasPrefix(trimmed, "<"):
		doc.kind = classifyXML(trimmed)
	case path.Ext(strings.ToLower(file.Name)) == brunoExtension || looksLikeBru(trimmed):
		doc.kind = kindBruno
	case looksLikeHTTP(trimmed):
		doc.kind = kindHTTP
	default:
		doc.data, doc.err = decodeNamed(file.Name, trimmed)
		if doc.err == nil {
			doc.kind = classifyNamed(file.Name, doc.data)
		}
	}
	return doc
}

func importableName(name string) bool {
	extension := path.Ext(strings.ToLower(name))
	return extension == "" || extension == brunoExtension || importableExtensions[extension]
}

func unsupportedType(name string) error {
	return locales.Errorf(locales.ImporterUnsupportedType, locales.Params{"type": path.Ext(strings.ToLower(name))})
}

func classifyXML(source string) string {
	decoder := xml.NewDecoder(strings.NewReader(source))
	for {
		token, err := decoder.Token()
		if err != nil {
			return kindUnknown
		}
		start, ok := token.(xml.StartElement)
		if !ok {
			continue
		}
		return xmlKind(start)
	}
}

func xmlKind(start xml.StartElement) string {
	switch {
	case start.Name.Local == "definitions" && start.Name.Space == wsdlNamespace:
		return kindWSDL
	case start.Name.Local == "description" && start.Name.Space == wsdl2Namespace:
		return kindWSDL
	case start.Name.Local == "schema" && start.Name.Space == schemaNamespace:
		return kindSchema
	}
	return kindUnknown
}

func classifyStructured(data any) string {
	root := object(data)
	if root == nil {
		return kindUnknown
	}
	info := object(root["info"])
	switch {
	case text(root["_type"]) == insomniaExportType && root["resources"] != nil:
		return kindInsomnia
	case isInsomniaV5(text(root["type"])):
		return kindInsomnia
	case object(root["log"]) != nil && object(root["log"])["entries"] != nil:
		return kindHAR
	case strings.Contains(text(info["schema"]), postmanSchemaMarker) || info["_postman_id"] != nil:
		return kindPostmanCollection
	case isPostmanDump(root):
		return kindPostmanDump
	case root["_postman_variable_scope"] != nil || isPostmanEnvironment(root):
		return kindPostmanEnvironment
	case root["openapi"] != nil || root["swagger"] != nil:
		return kindOpenAPI
	case root["opencollection"] != nil:
		return kindOpenCollection
	case root["gostman"] != nil:
		return kindGostman
	case object(root[restClientEnvironments]) != nil:
		return kindHTTPEnvironment
	case text(root["type"]) == "collection" && text(root["name"]) != "":
		return kindBrunoConfig
	case text(info["type"]) == kindBrunoEnvironment:
		return kindBrunoEnvironment
	case text(info["type"]) != "" && text(info["name"]) != "":
		return kindOpenItem
	case isOpenEnvironment(root):
		return kindOpenEnvironment
	}
	return kindUnknown
}

func isOpenEnvironment(root map[string]any) bool {
	variables, listed := root["variables"].([]any)
	if !listed || text(root["name"]) != "" {
		return listed
	}
	entries := objects(variables)
	return len(entries) > 0 && len(entries) == len(variables) && text(entries[0]["name"]) != ""
}

func isPostmanDump(root map[string]any) bool {
	_, collections := root["collections"].([]any)
	_, environments := root["environments"].([]any)
	return collections && environments
}

func isPostmanEnvironment(root map[string]any) bool {
	values := objects(root["values"])
	if len(values) == 0 || text(root["name"]) == "" {
		return false
	}
	_, hasKey := values[0]["key"]
	return hasKey
}

func looksLikeBru(source string) bool {
	line, _, _ := strings.Cut(source, "\n")
	line = strings.TrimSpace(line)
	name, found := strings.CutSuffix(line, " {")
	if !found {
		name, found = strings.CutSuffix(line, " [")
	}
	return found && brunoBlocks[name]
}
