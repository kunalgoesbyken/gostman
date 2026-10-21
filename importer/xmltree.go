package importer

import (
	"encoding/xml"
	"fmt"
	"strings"
)

type xmlNode struct {
	XMLName  xml.Name
	Attrs    []xml.Attr `xml:",any,attr"`
	Children []*xmlNode `xml:",any"`
}

func parseXML(source string) (*xmlNode, error) {
	decoder := xml.NewDecoder(strings.NewReader(source))
	var root xmlNode
	if err := decoder.Decode(&root); err != nil {
		return nil, fmt.Errorf(messageDocumentRead, err)
	}
	return &root, nil
}

func (n *xmlNode) attr(local string) string {
	for _, candidate := range n.Attrs {
		if candidate.Name.Local == local && candidate.Name.Space == "" {
			return candidate.Value
		}
	}
	return ""
}

func (n *xmlNode) attrIn(space, local string) string {
	for _, candidate := range n.Attrs {
		if candidate.Name.Local == local && candidate.Name.Space == space {
			return candidate.Value
		}
	}
	return ""
}

func (n *xmlNode) kids(local string) []*xmlNode {
	var found []*xmlNode
	for _, child := range n.Children {
		if child.XMLName.Local == local {
			found = append(found, child)
		}
	}
	return found
}

func (n *xmlNode) kid(local string) *xmlNode {
	if found := n.kids(local); len(found) > 0 {
		return found[0]
	}
	return nil
}

func (n *xmlNode) namespaces() map[string]string {
	declared := map[string]string{}
	for _, candidate := range n.Attrs {
		switch {
		case candidate.Name.Space == "xmlns":
			declared[candidate.Name.Local] = candidate.Value
		case candidate.Name.Space == "" && candidate.Name.Local == "xmlns":
			declared[""] = candidate.Value
		}
	}
	return declared
}

type qualifiedName struct {
	space string
	local string
}

func resolveName(value string, declared map[string]string) qualifiedName {
	prefix, local, hasPrefix := strings.Cut(value, ":")
	if !hasPrefix {
		return qualifiedName{space: declared[""], local: value}
	}
	return qualifiedName{space: declared[prefix], local: local}
}
