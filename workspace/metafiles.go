package workspace

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	FormatName    = "gostman-workspace"
	FormatVersion = 1
)

var (
	manifestKeys    = []string{"format", "version"}
	folderKeys      = append([]string{"id", "name", "order", "variables"}, settingsKeys...)
	environmentKeys = []string{"id", "name", "order", "color", "extends", "variables", "meta"}
)

type folderContent struct {
	folder Folder
	order  int64
}

type folderDocument struct {
	folderContent
	extras requestExtras
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
	folder := document.folder
	root := mappingNode()
	setField(root, "id", b.text(folder.Id))
	setField(root, "name", b.text(folder.Name))
	setField(root, "order", integerNode(document.order))
	setField(root, "variables", b.folderVariables(folder.Variables))
	b.settings(root, folder.Settings, document.extras)
	root.Content = append(root.Content, document.extras.request...)
	return root
}

func (b nodeBuilder) folderVariables(text string) *yaml.Node {
	if strings.TrimSpace(text) == "" {
		return nil
	}
	return b.variables(text)
}

func readFolder(root *yaml.Node) (folderDocument, error) {
	var failure error
	fields := readFields(root, folderKeys, &failure)
	document := folderDocument{extras: requestExtras{request: fields.extras}}
	document.order = fields.integer("order")
	document.folder = Folder{
		Id:        fields.text("id"),
		Name:      fields.text("name"),
		Variables: fields.variables(),
		Settings:  readSettings(fields, &document.extras, &failure),
	}
	return document, failure
}

func readFolderContent(root *yaml.Node) (folderContent, error) {
	document, err := readFolder(root)
	return document.folderContent, err
}

func normalizeFolder(document folderDocument) (folderContent, error) {
	return readFolderContent(nodeBuilder{}.folder(document))
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
	setField(root, "color", b.text(document.environment.Color))
	setField(root, "extends", b.text(document.environment.Extends))
	setField(root, "variables", b.variables(document.environment.Variables))
	setField(root, "meta", b.variables(document.environment.Meta))
	root.Content = append(root.Content, document.extras...)
	return root
}

func (r *fieldReader) metaVariables() string {
	if !r.has("meta") {
		return emptyObject
	}
	return r.jsonText("meta", true, unchanged)
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
		environment: Environment{
			Id: fields.text("id"), Name: fields.text("name"), Variables: fields.variables(),
			Color: fields.text("color"), Extends: fields.text("extends"), Meta: fields.metaVariables(),
		},
		order: fields.integer("order"),
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
