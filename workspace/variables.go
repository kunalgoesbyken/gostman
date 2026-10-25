package workspace

import (
	"bufio"
	"bytes"
	"errors"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	DotEnvName       = ".env"
	variablesKey     = "variables"
	variablesMetaKey = "variablesMeta"
	exportPrefix     = "export "
	maxDotEnvBytes   = 1 << 20
)

func (w *Workspace) readManifest() (*yaml.Node, error) {
	content, err := w.disk.read(ManifestName)
	if err != nil {
		return nil, err
	}
	return parseDocument(content)
}

func (w *Workspace) Variables() string {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.manifestObject(variablesKey)
}

func (w *Workspace) VariablesMeta() string {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.manifestObject(variablesMetaKey)
}

func (w *Workspace) manifestObject(key string) string {
	root, err := w.readManifest()
	if err != nil {
		return emptyObject
	}
	var failure error
	fields := readFields(root, []string{key}, &failure)
	if !fields.has(key) {
		return emptyObject
	}
	text := fields.jsonText(key, true, unchanged)
	if failure != nil || text == "" {
		return emptyObject
	}
	return text
}

func withoutKey(mapping *yaml.Node, key string) {
	kept := mapping.Content[:0]
	for i := 0; i+1 < len(mapping.Content); i += 2 {
		if mapping.Content[i].Value != key {
			kept = append(kept, mapping.Content[i], mapping.Content[i+1])
		}
	}
	mapping.Content = kept
}

func (w *Workspace) SaveVariables(text string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.saveVariables(text, w.manifestObject(variablesMetaKey))
}

func (w *Workspace) SaveMarkedVariables(text, meta string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.saveVariables(text, meta)
}

func (w *Workspace) saveVariables(text, meta string) error {
	root, err := w.readManifest()
	if err != nil {
		return err
	}
	plain, _ := WithoutSecretVariables(text, meta)
	if err := setObject(root, variablesKey, plain); err != nil {
		return err
	}
	if err := setObject(root, variablesMetaKey, meta); err != nil {
		return err
	}
	content, err := encodeDocument(root)
	if err != nil {
		return err
	}
	return w.disk.write(ManifestName, content)
}

func setObject(root *yaml.Node, key, text string) error {
	withoutKey(root, key)
	if strings.TrimSpace(text) == "" || strings.TrimSpace(text) == emptyObject {
		return nil
	}
	node := nodeBuilder{}.jsonText(text)
	if node == nil || !isContainer(node) {
		return errors.New("collection variables must be a JSON object")
	}
	setField(root, key, node)
	return nil
}

func (w *Workspace) DotEnv() map[string]string {
	content, err := w.disk.read(DotEnvName)
	if err != nil {
		return map[string]string{}
	}
	return ParseDotEnv(content)
}

func ParseDotEnv(content []byte) map[string]string {
	values := map[string]string{}
	if len(content) > maxDotEnvBytes {
		return values
	}
	content = bytes.TrimPrefix(content, []byte("\xef\xbb\xbf"))
	scanner := bufio.NewScanner(bytes.NewReader(content))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, exportPrefix)
		name, value, found := strings.Cut(line, "=")
		name = strings.TrimSpace(name)
		if !found || name == "" {
			continue
		}
		values[name] = dotEnvValue(strings.TrimSpace(value))
	}
	return values
}

func dotEnvValue(raw string) string {
	if len(raw) >= 2 {
		quote := raw[0]
		if (quote == '"' || quote == '\'') && strings.IndexByte(raw[1:], quote) >= 0 {
			inner := raw[1 : 1+strings.IndexByte(raw[1:], quote)]
			if quote == '"' {
				return strings.NewReplacer(`\n`, "\n", `\t`, "\t", `\"`, `"`, `\\`, `\`).Replace(inner)
			}
			return inner
		}
	}
	if comment := strings.Index(raw, " #"); comment >= 0 {
		raw = strings.TrimSpace(raw[:comment])
	}
	return raw
}
