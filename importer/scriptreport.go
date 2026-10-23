package importer

import (
	"fmt"
	"strings"
)

const (
	shownNotes      = 5
	maxScriptNotes  = 100
	stagePre        = "pre-request script"
	stagePost       = "test script"
	stageAfter      = "post-response script"
	labelCollection = "collection %q"
	labelFolder     = "folder %q"
	labelRequest    = "request %q"
)

type scriptTally struct {
	translated int
	failed     int
	reported   int
}

func (c *collector) translateScript(d *dialect, label, stage, source string) string {
	if strings.TrimSpace(source) == "" {
		return source
	}
	translation := translateSource(d, source)
	c.scripts.translated += translation.translated
	c.scripts.failed += translation.failed
	c.reportNotes(d, label, stage, translation.notes)
	return translation.text
}

func stageName(listen string) string {
	if listen == listenPreRequest {
		return stagePre
	}
	return stagePost
}

func (c *collector) reportNotes(d *dialect, label, stage string, notes []scriptNote) {
	for index, note := range notes {
		if index == shownNotes {
			c.Warnings = append(c.Warnings, fmt.Sprintf(messageScriptMore, d.name, label, stage, len(notes)-shownNotes))
			return
		}
		if c.scripts.reported >= maxScriptNotes {
			return
		}
		c.scripts.reported++
		c.Warnings = append(c.Warnings, fmt.Sprintf(messageScriptLine, d.name, label, stage, note.line, note.text))
	}
}

func (c *collector) summarizeScripts(d *dialect, name string) {
	if c.scripts.translated+c.scripts.failed == 0 {
		return
	}
	c.Warnings = append(c.Warnings, fmt.Sprintf(messageScriptTotals, d.name, name, c.scripts.translated, d.api, c.scripts.failed))
	c.scripts.translated, c.scripts.failed = 0, 0
}
