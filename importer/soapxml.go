package importer

import (
	"fmt"
	"strings"
)

const (
	maxSchemaDepth    = 8
	maxEnvelopeNodes  = 400
	indentUnit        = "  "
	envelopePrefix    = "soapenv"
	schemaPrefixStart = 1
	bodyIndent        = 2
)

type envelopeBuilder struct {
	schemas  []*schemaSet
	prefixes map[string]string
	order    []string
	nodes    int
}

func (b *envelopeBuilder) prefixFor(space string) string {
	if space == "" {
		return ""
	}
	if prefix, known := b.prefixes[space]; known {
		return prefix
	}
	prefix := fmt.Sprintf("ns%d", len(b.prefixes)+schemaPrefixStart)
	b.prefixes[space] = prefix
	b.order = append(b.order, space)
	return prefix
}

func (b *envelopeBuilder) body(operation wsdlOperation) string {
	var out strings.Builder
	if operation.rpc {
		prefix := b.prefixFor(operation.spaceRP)
		name := qualify(prefix, operation.name)
		out.WriteString(indentUnit + indentUnit + indentUnit + "<" + name + ">\n")
		for _, part := range operation.parts {
			b.part(&out, part, 4)
		}
		out.WriteString(indentUnit + indentUnit + indentUnit + "</" + name + ">\n")
		return out.String()
	}
	for _, part := range operation.parts {
		b.part(&out, part, bodyIndent)
	}
	return out.String()
}

func qualify(prefix, name string) string {
	if prefix == "" {
		return name
	}
	return prefix + ":" + name
}

func (b *envelopeBuilder) part(out *strings.Builder, part wsdlPart, depth int) {
	if part.element.local != "" {
		if declared := b.globalElement(part.element); declared != nil {
			b.element(out, declared.node, declared.schema, true, depth, 0)
		}
		return
	}
	b.typed(out, part.name, strings.Repeat(indentUnit, depth), part.typ, &schemaSet{}, depth, 0)
}

type declaredElement struct {
	node   *xmlNode
	schema *schemaSet
}

func (b *envelopeBuilder) globalElement(name qualifiedName) *declaredElement {
	if set := lookupSchema(b.schemas, name.space); set != nil {
		if node := set.elements[name.local]; node != nil {
			return &declaredElement{node: node, schema: set}
		}
	}
	for _, set := range b.schemas {
		if node := set.elements[name.local]; node != nil {
			return &declaredElement{node: node, schema: set}
		}
	}
	return nil
}

func (b *envelopeBuilder) element(out *strings.Builder, node *xmlNode, schema *schemaSet, global bool, indent, depth int) {
	if b.nodes >= maxEnvelopeNodes {
		return
	}
	b.nodes++
	if reference := node.attr("ref"); reference != "" {
		if found := b.globalElement(resolveName(reference, schema.namespaces)); found != nil && depth < maxSchemaDepth {
			b.element(out, found.node, found.schema, true, indent, depth+1)
		}
		return
	}
	space := ""
	if global || schema.qualified || node.attr("form") == "qualified" {
		space = schema.namespace
	}
	name := qualify(b.prefixFor(space), node.attr("name"))
	pad := strings.Repeat(indentUnit, indent)
	if typeName := node.attr("type"); typeName != "" {
		resolved := resolveName(typeName, schema.namespaces)
		b.typed(out, name, pad, resolved, schema, indent, depth)
		return
	}
	if content := node.kid("complexType"); content != nil {
		b.complex(out, name, pad, content, schema, indent, depth)
		return
	}
	b.scalar(out, name, pad, "")
}

func (b *envelopeBuilder) typed(out *strings.Builder, name, pad string, typeName qualifiedName, schema *schemaSet, indent, depth int) {
	if typeName.space == schemaNamespace {
		b.scalar(out, name, pad, typeName.local)
		return
	}
	owner := lookupSchema(b.schemas, typeName.space)
	if owner == nil {
		owner = schema
	}
	declared := owner.types[typeName.local]
	if declared == nil || depth >= maxSchemaDepth {
		b.scalar(out, name, pad, "")
		return
	}
	if declared.XMLName.Local == "simpleType" {
		b.scalar(out, name, pad, enumerationSample(declared))
		return
	}
	b.complex(out, name, pad, declared, owner, indent, depth+1)
}

func enumerationSample(declared *xmlNode) string {
	if restriction := declared.kid("restriction"); restriction != nil {
		if values := restriction.kids("enumeration"); len(values) > 0 {
			return "enum:" + values[0].attr("value")
		}
		if base := restriction.attr("base"); base != "" {
			return localName(base)
		}
	}
	return ""
}

func (b *envelopeBuilder) complex(out *strings.Builder, name, pad string, declared *xmlNode, schema *schemaSet, indent, depth int) {
	var inner strings.Builder
	b.content(&inner, declared, schema, indent+1, depth)
	if inner.Len() == 0 {
		b.scalar(out, name, pad, "")
		return
	}
	out.WriteString(pad + "<" + name + ">\n" + inner.String() + pad + "</" + name + ">\n")
}

func (b *envelopeBuilder) content(out *strings.Builder, declared *xmlNode, schema *schemaSet, indent, depth int) {
	if extension := firstExtension(declared); extension != nil {
		base := resolveName(extension.attr("base"), schema.namespaces)
		if owner := lookupSchema(b.schemas, base.space); owner != nil && owner.types[base.local] != nil && depth < maxSchemaDepth {
			b.content(out, owner.types[base.local], owner, indent, depth+1)
		}
		b.group(out, extension, schema, indent, depth)
		return
	}
	b.group(out, declared, schema, indent, depth)
}

func firstExtension(declared *xmlNode) *xmlNode {
	if content := declared.kid("complexContent"); content != nil {
		return content.kid("extension")
	}
	return nil
}

func (b *envelopeBuilder) group(out *strings.Builder, owner *xmlNode, schema *schemaSet, indent, depth int) {
	for _, kind := range []string{"sequence", "all", "choice"} {
		for _, group := range owner.kids(kind) {
			for _, child := range group.kids("element") {
				b.element(out, child, schema, false, indent, depth)
			}
			b.group(out, group, schema, indent, depth)
		}
	}
}

func (b *envelopeBuilder) scalar(out *strings.Builder, name, pad, typeName string) {
	out.WriteString(pad + "<" + name + ">" + sampleFor(typeName) + "</" + name + ">\n")
}

func sampleFor(typeName string) string {
	if strings.HasPrefix(typeName, "enum:") {
		return strings.TrimPrefix(typeName, "enum:")
	}
	if sample, known := sampleValues[typeName]; known {
		return sample
	}
	if numericTypes[typeName] {
		return "0"
	}
	return "?"
}

func (b *envelopeBuilder) envelope(version soapVersion, body string) string {
	var out strings.Builder
	out.WriteString("<" + envelopePrefix + ":Envelope xmlns:" + envelopePrefix + `="` + version.envelope + `"`)
	for _, space := range b.order {
		out.WriteString(" xmlns:" + b.prefixes[space] + `="` + escapeAttribute(space) + `"`)
	}
	out.WriteString(">\n")
	out.WriteString(indentUnit + "<" + envelopePrefix + ":Header/>\n")
	out.WriteString(indentUnit + "<" + envelopePrefix + ":Body>\n")
	out.WriteString(body)
	out.WriteString(indentUnit + "</" + envelopePrefix + ":Body>\n")
	out.WriteString("</" + envelopePrefix + ":Envelope>")
	return out.String()
}

func escapeAttribute(value string) string {
	return strings.NewReplacer("&", "&amp;", `"`, "&quot;", "<", "&lt;").Replace(value)
}
