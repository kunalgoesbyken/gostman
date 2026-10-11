package workspace

import (
	"fmt"

	"gopkg.in/yaml.v3"
)

const (
	FormatName    = "gostman-workspace"
	FormatVersion = 1
)

var (
	manifestKeys    = []string{"format", "version"}
	folderKeys      = []string{"id", "name", "order"}
	environmentKeys = []string{"id", "name", "order", "variables"}
)

type folderContent struct {
	id    string
	name  string
	order int64
}

type folderDocument struct {
	folderContent
	extras []*yaml.Node
}

type environmentContent struct {
	environment Environment
	order       int64
}

type environmentDocument struct {
	environmentContent
	extras []*yaml.Node
}

func encodeManifest() ([]byte, error) {
	root := mappingNode()
	setField(root, "format", nodeBuilder{}.text(FormatName))
	setField(root, "version", integerNode(FormatVersion))
	return encodeDocument(root)
}

func checkManifest(content []byte) error {
	root, err := parseDocument(content)
	if err != nil {
		return err
	}
	var failure error
	fields := readFields(root, manifestKeys, &failure)
	format, version := fields.text("format"), fields.integer("version")
	switch {
	case failure != nil:
		return failure
	case format != FormatName:
		return failAt(root, fmt.Sprintf("format must be %s", FormatName))
	case version < 1:
		return failAt(root, "version must be 1 or higher")
	case version > FormatVersion:
		return failAt(root, fmt.Sprintf("version %d was written by a newer Gostman; this one reads up to version %d", version, FormatVersion))
	}
	return nil
}

func (b nodeBuilder) folder(document folderDocument) *yaml.Node {
	root := mappingNode()
	setField(root, "id", b.text(document.id))
	setField(root, "name", b.text(document.name))
	setField(root, "order", integerNode(document.order))
	root.Content = append(root.Content, document.extras...)
	return root
}

func readFolder(root *yaml.Node) (folderDocument, error) {
	var failure error
	fields := readFields(root, folderKeys, &failure)
	content := folderContent{id: fields.text("id"), name: fields.text("name"), order: fields.integer("order")}
	return folderDocument{folderContent: content, extras: fields.extras}, failure
}

func readFolderContent(root *yaml.Node) (folderContent, error) {
	document, err := readFolder(root)
	return document.folderContent, err
}

func encodeFolder(document folderDocument) ([]byte, error) {
	build := func(builder nodeBuilder) *yaml.Node { return builder.folder(document) }
	return encodeVerified(build, readFolderContent)
}

func (b nodeBuilder) variables(text string) *yaml.Node {
	if text == emptyObject {
		return nil
	}
	if text == "" {
		return b.explicitText(text)
	}
	return b.jsonText(text)
}

func (b nodeBuilder) environment(document environmentDocument) *yaml.Node {
	root := mappingNode()
	setField(root, "id", b.text(document.environment.Id))
	setField(root, "name", b.text(document.environment.Name))
	setField(root, "order", integerNode(document.order))
	setField(root, "variables", b.variables(document.environment.Variables))
	root.Content = append(root.Content, document.extras...)
	return root
}

func (r *fieldReader) variables() string {
	if !r.has("variables") {
		return emptyObject
	}
	return r.jsonText("variables", true, unchanged)
}

func readEnvironment(root *yaml.Node) (environmentDocument, error) {
	var failure error
	fields := readFields(root, environmentKeys, &failure)
	content := environmentContent{
		environment: Environment{Id: fields.text("id"), Name: fields.text("name"), Variables: fields.variables()},
		order:       fields.integer("order"),
	}
	return environmentDocument{environmentContent: content, extras: fields.extras}, failure
}

func readEnvironmentContent(root *yaml.Node) (environmentContent, error) {
	document, err := readEnvironment(root)
	return document.environmentContent, err
}

func normalizeEnvironment(document environmentDocument) (Environment, error) {
	content, err := readEnvironmentContent(nodeBuilder{}.environment(document))
	return content.environment, err
}

func encodeEnvironment(document environmentDocument) ([]byte, error) {
	build := func(builder nodeBuilder) *yaml.Node { return builder.environment(document) }
	return encodeVerified(build, readEnvironmentContent)
}
