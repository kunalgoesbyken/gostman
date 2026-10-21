package importer

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"path"
	"strings"

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

	kindInsomnia            = "insomnia"
	kindHAR                 = "har"
	kindWSDL                = "wsdl"
	kindSchema              = "schema"
	kindPostmanCollection   = "postman-collection"
	kindPostmanEnvironment  = "postman-environment"
	kindOpenAPI             = "openapi"
	kindBruno               = "bruno"
	kindBrunoConfig         = "bruno-config"
	kindOpenCollection      = "opencollection"
	kindGostman             = "gostman"
	kindUnknown             = ""
	postmanSchemaMarker     = "getpostman.com/json/collection"
	insomniaV5Prefix        = "collection.insomnia.rest/5"
	insomniaExportType      = "export"
	wsdlNamespace           = "http://schemas.xmlsoap.org/wsdl/"
	wsdl2Namespace          = "http://www.w3.org/ns/wsdl"
	schemaNamespace         = "http://www.w3.org/2001/XMLSchema"
	brunoConfigFile         = "bruno.json"
	brunoCollectionFile     = "collection.bru"
	brunoFolderFile         = "folder.bru"
	brunoEnvironmentsFolder = "environments"
	brunoExtension          = ".bru"
)

var importableExtensions = map[string]bool{".json": true, ".yml": true, ".yaml": true, ".xml": true, ".wsdl": true, ".xsd": true, ".har": true, ".txt": true}

var kindFormats = map[string]string{
	kindInsomnia:           FormatInsomnia,
	kindHAR:                FormatHAR,
	kindWSDL:               FormatWSDL,
	kindSchema:             FormatWSDL,
	kindPostmanCollection:  FormatPostman,
	kindPostmanEnvironment: FormatPostman,
	kindOpenAPI:            FormatOpenAPI,
	kindBruno:              FormatBruno,
	kindBrunoConfig:        FormatBruno,
	kindOpenCollection:     FormatBruno,
	kindGostman:            FormatGostman,
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
	case strings.HasPrefix(trimmed, "<"):
		doc.kind = classifyXML(trimmed)
	case path.Ext(strings.ToLower(file.Name)) == brunoExtension || looksLikeBru(trimmed):
		doc.kind = kindBruno
	default:
		doc.data, doc.err = decodeStructured(trimmed)
		if doc.err == nil {
			doc.kind = classifyStructured(doc.data)
		}
	}
	return doc
}

func importableName(name string) bool {
	extension := path.Ext(strings.ToLower(name))
	return extension == "" || extension == brunoExtension || importableExtensions[extension]
}

func unsupportedType(name string) error {
	return fmt.Errorf(messageUnsupportedTypeDetail, path.Ext(strings.ToLower(name)))
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
	case strings.HasPrefix(text(root["type"]), insomniaV5Prefix):
		return kindInsomnia
	case object(root["log"]) != nil && object(root["log"])["entries"] != nil:
		return kindHAR
	case strings.Contains(text(info["schema"]), postmanSchemaMarker) || info["_postman_id"] != nil:
		return kindPostmanCollection
	case root["_postman_variable_scope"] != nil || isPostmanEnvironment(root):
		return kindPostmanEnvironment
	case root["openapi"] != nil || root["swagger"] != nil:
		return kindOpenAPI
	case root["opencollection"] != nil:
		return kindOpenCollection
	case root["gostman"] != nil:
		return kindGostman
	case text(root["type"]) == "collection" && text(root["name"]) != "":
		return kindBrunoConfig
	}
	return kindUnknown
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

func firstXMLError(source string) error {
	decoder := xml.NewDecoder(strings.NewReader(source))
	for {
		if _, err := decoder.Token(); err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}
			return err
		}
	}
}

func decodeXML(source string, target any) error {
	decoder := xml.NewDecoder(bytes.NewReader([]byte(source)))
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf(messageDocumentRead, err)
	}
	return nil
}
