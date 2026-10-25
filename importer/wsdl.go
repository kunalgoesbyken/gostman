package importer

import (
	"path"
	"strings"
	"unicode"

	"github.com/kunalgoesbyken/gostman/locales"
)

const (
	soap11Namespace = "http://schemas.xmlsoap.org/wsdl/soap/"
	soap12Namespace = "http://schemas.xmlsoap.org/wsdl/soap12/"
	wsoapNamespace  = "http://www.w3.org/ns/wsdl/soap"
	envelope11      = "http://schemas.xmlsoap.org/soap/envelope/"
	envelope12      = "http://www.w3.org/2003/05/soap-envelope"
	styleRPC        = "rpc"
	endpointSuffix  = "Url"
)

var sampleValues = map[string]string{
	"string": "string", "boolean": "false", "date": "2000-01-01", "dateTime": "2000-01-01T00:00:00Z", "time": "00:00:00",
	"anyURI": "https://example.com", "base64Binary": "AA==", "hexBinary": "00",
}

var numericTypes = map[string]bool{
	"int": true, "integer": true, "long": true, "short": true, "byte": true, "decimal": true, "double": true, "float": true,
	"unsignedInt": true, "unsignedLong": true, "unsignedShort": true, "unsignedByte": true, "positiveInteger": true,
	"nonNegativeInteger": true, "negativeInteger": true, "nonPositiveInteger": true,
}

type soapVersion struct {
	envelope string
	mime     string
	isSOAP12 bool
}

var (
	soap11 = soapVersion{envelope: envelope11, mime: "text/xml"}
	soap12 = soapVersion{envelope: envelope12, mime: "application/soap+xml", isSOAP12: true}
)

type schemaSet struct {
	namespace  string
	qualified  bool
	elements   map[string]*xmlNode
	types      map[string]*xmlNode
	namespaces map[string]string
}

type wsdlOperation struct {
	name    string
	action  string
	rpc     bool
	spaceRP string
	parts   []wsdlPart
}

type wsdlPart struct {
	name    string
	element qualifiedName
	typ     qualifiedName
}

func (c *collector) readWSDL(doc document, supporting []document) {
	root, err := parseXML(doc.file.Text)
	if err != nil {
		c.skip(locales.ImporterSkipFileError, locales.Params{"file": doc.file.Name, "detail": err.Error()})
		return
	}
	name := cleanName(root.attr("name"), fileStem(doc.file.Name))
	c.read(name, FormatWSDL, func() {
		schemas := c.schemaSets(root, supporting)
		rootID := c.addFolder(name, "")
		c.ownCollectionVariables(rootID, nil)
		if root.XMLName.Space == wsdl2Namespace {
			c.wsdl2(root, schemas, rootID)
			return
		}
		c.wsdl1(root, schemas, rootID)
	})
}

func (c *collector) schemaSets(root *xmlNode, supporting []document) []*schemaSet {
	var sets []*schemaSet
	if types := root.kid("types"); types != nil {
		for _, schema := range types.kids("schema") {
			sets = append(sets, newSchemaSet(schema, root.namespaces()))
		}
	}
	included := map[string]bool{}
	for _, doc := range supporting {
		parsed, err := parseXML(doc.file.Text)
		if err != nil {
			c.skip(locales.ImporterSkipFileError, locales.Params{"file": doc.file.Name, "detail": err.Error()})
			continue
		}
		included[path.Base(doc.file.Name)] = true
		sets = append(sets, newSchemaSet(parsed, nil))
	}
	c.reportUnresolved(root, included)
	return sets
}

func (c *collector) reportUnresolved(root *xmlNode, included map[string]bool) {
	var missing []string
	collect := func(nodes []*xmlNode, attribute string) {
		for _, node := range nodes {
			if location := node.attr(attribute); location != "" && !included[path.Base(location)] {
				missing = append(missing, location)
			}
		}
	}
	collect(root.kids("import"), "location")
	if types := root.kid("types"); types != nil {
		for _, schema := range types.kids("schema") {
			collect(schema.kids("import"), "schemaLocation")
			collect(schema.kids("include"), "schemaLocation")
		}
	}
	if len(missing) > 0 {
		c.lead(locales.New(locales.ImporterUnresolved, locales.Params{"what": "The WSDL", "files": strings.Join(missing, ", ")}))
	}
}

func newSchemaSet(schema *xmlNode, inherited map[string]string) *schemaSet {
	set := &schemaSet{
		namespace:  schema.attr("targetNamespace"),
		qualified:  schema.attr("elementFormDefault") == "qualified",
		elements:   map[string]*xmlNode{},
		types:      map[string]*xmlNode{},
		namespaces: map[string]string{},
	}
	for prefix, space := range inherited {
		set.namespaces[prefix] = space
	}
	for prefix, space := range schema.namespaces() {
		set.namespaces[prefix] = space
	}
	for _, element := range schema.kids("element") {
		set.elements[element.attr("name")] = element
	}
	for _, kind := range []string{"complexType", "simpleType"} {
		for _, declared := range schema.kids(kind) {
			set.types[declared.attr("name")] = declared
		}
	}
	return set
}

func lookupSchema(sets []*schemaSet, space string) *schemaSet {
	for _, set := range sets {
		if set.namespace == space {
			return set
		}
	}
	return nil
}

func localName(value string) string {
	return resolveName(value, nil).local
}

func variableName(source string) string {
	var out strings.Builder
	for _, r := range source {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '-' {
			out.WriteRune(r)
		} else {
			out.WriteRune('_')
		}
	}
	name := out.String()
	if name == "" || unicode.IsDigit([]rune(name)[0]) || name[0] == '-' {
		return "_" + name
	}
	return name
}

func (c *collector) wsdl1(root *xmlNode, schemas []*schemaSet, rootID string) {
	declared := root.namespaces()
	messages := indexByName(root.kids("message"))
	portTypes := indexByName(root.kids("portType"))
	bindings := indexByName(root.kids("binding"))
	generated := map[string]bool{}
	for _, service := range root.kids("service") {
		folderID := c.addFolder(service.attr("name"), rootID)
		endpoint := variableName(service.attr("name")) + endpointSuffix
		for _, port := range service.kids("port") {
			binding := bindings[localName(port.attr("binding"))]
			if binding == nil {
				continue
			}
			version, found := bindingVersion(binding)
			if !found {
				c.skip(locales.ImporterSkipSoapOnly, locales.Params{"name": port.attr("name")})
				continue
			}
			c.setEndpoint(rootID, endpoint, portAddress(port))
			portType := portTypes[localName(binding.attr("type"))]
			for _, operation := range wsdl1Operations(binding, portType, messages, declared, root.attr("targetNamespace")) {
				key := binding.attr("type") + "/" + operation.name
				if generated[key] {
					continue
				}
				generated[key] = true
				c.soapRequest(operation, version, schemas, endpoint, folderID)
			}
		}
	}
}

func (c *collector) setEndpoint(rootID, name, address string) {
	c.ownCollectionVariables(rootID, map[string]string{name: address})
}

func indexByName(nodes []*xmlNode) map[string]*xmlNode {
	index := map[string]*xmlNode{}
	for _, node := range nodes {
		index[node.attr("name")] = node
	}
	return index
}

func bindingVersion(binding *xmlNode) (soapVersion, bool) {
	for _, child := range binding.Children {
		if child.XMLName.Local != "binding" {
			continue
		}
		switch child.XMLName.Space {
		case soap11Namespace:
			return soap11, true
		case soap12Namespace:
			return soap12, true
		}
	}
	return soapVersion{}, false
}

func portAddress(port *xmlNode) string {
	if address := port.kid("address"); address != nil {
		return address.attr("location")
	}
	return ""
}

func wsdl1Operations(binding, portType *xmlNode, messages map[string]*xmlNode, declared map[string]string, targetNamespace string) []wsdlOperation {
	bindingStyle := ""
	for _, child := range binding.Children {
		if child.XMLName.Local == "binding" {
			bindingStyle = child.attr("style")
		}
	}
	var operations []wsdlOperation
	for _, bound := range binding.kids("operation") {
		operation := wsdlOperation{name: bound.attr("name"), spaceRP: targetNamespace, rpc: bindingStyle == styleRPC}
		for _, child := range bound.Children {
			if child.XMLName.Local == "operation" {
				operation.action = child.attr("soapAction")
				if style := child.attr("style"); style != "" {
					operation.rpc = style == styleRPC
				}
			}
		}
		if input := bound.kid("input"); input != nil {
			for _, body := range input.Children {
				if body.XMLName.Local == "body" && body.attr("namespace") != "" {
					operation.spaceRP = body.attr("namespace")
				}
			}
		}
		operation.parts = messageParts(portType, operation.name, messages, declared)
		operations = append(operations, operation)
	}
	return operations
}

func messageParts(portType *xmlNode, operationName string, messages map[string]*xmlNode, declared map[string]string) []wsdlPart {
	if portType == nil {
		return nil
	}
	for _, abstract := range portType.kids("operation") {
		if abstract.attr("name") != operationName {
			continue
		}
		input := abstract.kid("input")
		if input == nil {
			return nil
		}
		message := messages[localName(input.attr("message"))]
		if message == nil {
			return nil
		}
		var parts []wsdlPart
		for _, part := range message.kids("part") {
			parts = append(parts, wsdlPart{name: part.attr("name"), element: partName(part.attr("element"), declared), typ: partName(part.attr("type"), declared)})
		}
		return parts
	}
	return nil
}

func partName(value string, declared map[string]string) qualifiedName {
	if value == "" {
		return qualifiedName{}
	}
	return resolveName(value, declared)
}

func (c *collector) wsdl2(root *xmlNode, schemas []*schemaSet, rootID string) {
	declared := root.namespaces()
	bindings := map[string]*xmlNode{}
	for _, binding := range root.kids("binding") {
		bindings[binding.attr("name")] = binding
	}
	interfaces := indexByName(root.kids("interface"))
	for _, service := range root.kids("service") {
		folderID := c.addFolder(service.attr("name"), rootID)
		endpoint := variableName(service.attr("name")) + endpointSuffix
		for _, port := range service.kids("endpoint") {
			binding := bindings[localName(port.attr("binding"))]
			if binding == nil {
				continue
			}
			c.setEndpoint(rootID, endpoint, port.attr("address"))
			version := soap12
			if binding.attrIn(wsoapNamespace, "version") == "1.1" {
				version = soap11
			}
			actions := map[string]string{}
			for _, bound := range binding.kids("operation") {
				actions[localName(bound.attr("ref"))] = bound.attrIn(wsoapNamespace, "action")
			}
			if described := interfaces[localName(binding.attr("interface"))]; described != nil {
				for _, operation := range wsdl2Operations(described, actions, declared) {
					c.soapRequest(operation, version, schemas, endpoint, folderID)
				}
			}
		}
	}
}

func wsdl2Operations(described *xmlNode, actions map[string]string, declared map[string]string) []wsdlOperation {
	var operations []wsdlOperation
	for _, abstract := range described.kids("operation") {
		operation := wsdlOperation{name: abstract.attr("name"), action: actions[abstract.attr("name")]}
		if input := abstract.kid("input"); input != nil && input.attr("element") != "" && input.attr("element") != "#none" {
			operation.parts = []wsdlPart{{element: resolveName(input.attr("element"), declared)}}
		}
		operations = append(operations, operation)
	}
	return operations
}

func (c *collector) soapRequest(operation wsdlOperation, version soapVersion, schemas []*schemaSet, endpoint, folderID string) {
	builder := &envelopeBuilder{schemas: schemas, prefixes: map[string]string{}}
	body := builder.body(operation)
	request := parts{
		name:     operation.name,
		method:   "POST",
		url:      variableOpen + endpoint + variableClose,
		body:     builder.envelope(version, body),
		bodyType: bodyXML,
		headers:  soapHeaders(version, operation.action),
	}
	c.build(request, folderID)
}

func soapHeaders(version soapVersion, action string) []row {
	contentType := version.mime + "; charset=utf-8"
	if version.isSOAP12 {
		if action != "" {
			contentType += `; action="` + action + `"`
		}
		return []row{{Key: "Content-Type", Value: contentType, Enabled: true}}
	}
	return []row{
		{Key: "Content-Type", Value: contentType, Enabled: true},
		{Key: "SOAPAction", Value: `"` + action + `"`, Enabled: true},
	}
}
