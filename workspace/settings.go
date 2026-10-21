package workspace

import (
	"bytes"

	"github.com/krockxz/gostman/engine"
	"gopkg.in/yaml.v3"
)

var settingsKeys = []string{"description", "headers", "auth", "preScript", "postScript", "assertions"}

func (b nodeBuilder) settings(root *yaml.Node, settings Settings, extras requestExtras) {
	setField(root, "description", b.text(settings.Description))
	setField(root, "headers", b.pairs(settings.Headers))
	setField(root, "auth", b.settingsAuth(settings.Auth, extras))
	setField(root, "preScript", b.text(settings.PreScript))
	setField(root, "postScript", b.text(settings.PostScript))
	setField(root, "assertions", b.rows(settings.Assertions))
}

func (b nodeBuilder) settingsAuth(auth engine.Auth, extras requestExtras) *yaml.Node {
	if auth == (engine.Auth{}) {
		return nil
	}
	return b.auth(auth, extras)
}

func readSettings(fields *fieldReader, extras *requestExtras, failure *error) Settings {
	return Settings{
		Description: fields.text("description"),
		Headers:     fields.pairs("headers"),
		Auth:        readAuth(fields.fields["auth"], extras, failure),
		PreScript:   fields.text("preScript"),
		PostScript:  fields.text("postScript"),
		Assertions:  fields.jsonText("assertions", false, withEnabledDefaults),
	}
}

func (b nodeBuilder) withSettings(manifest *yaml.Node, settings Settings) *yaml.Node {
	for _, key := range settingsKeys {
		withoutKey(manifest, key)
	}
	b.settings(manifest, settings, requestExtras{})
	return manifest
}

func readManifestSettings(manifest *yaml.Node) (Settings, error) {
	var failure error
	var extras requestExtras
	fields := readFields(manifest, settingsKeys, &failure)
	return readSettings(fields, &extras, &failure), failure
}

func (w *Workspace) Settings() Settings {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.manifestSettings()
}

func (w *Workspace) manifestSettings() Settings {
	root, err := w.readManifest()
	if err != nil {
		return Settings{Headers: emptyObject}
	}
	settings, err := readManifestSettings(root)
	if err != nil {
		return Settings{Headers: emptyObject}
	}
	return settings
}

func (w *Workspace) SaveSettings(settings Settings) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	content, err := w.disk.read(ManifestName)
	if err != nil {
		return err
	}
	if _, err := parseDocument(content); err != nil {
		return err
	}
	build := func(builder nodeBuilder) *yaml.Node {
		manifest, _ := parseDocument(content)
		return builder.withSettings(manifest, settings)
	}
	encoded, err := encodeVerified(build, readManifestSettings)
	if err != nil {
		return err
	}
	if bytes.Equal(encoded, content) {
		return nil
	}
	return w.disk.write(ManifestName, encoded)
}
