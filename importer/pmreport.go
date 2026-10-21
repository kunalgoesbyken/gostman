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
	labelCollection = "collection %q"
	labelFolder     = "folder %q"
	labelRequest    = "request %q"
)

type scriptTally struct {
	translated int
	failed     int
	reported   int
}

func (c *collector) translateScript(label, listen, source string) string {
	if strings.TrimSpace(source) == "" {
		return source
	}
	translation := translatePostmanScript(source)
	c.postman.translated += translation.translated
	c.postman.failed += translation.failed
	c.reportNotes(label, stageName(listen), translation.notes)
	return translation.text
}

func stageName(listen string) string {
	if listen == listenPreRequest {
		return stagePre
	}
	return stagePost
}

func (c *collector) reportNotes(label, stage string, notes []scriptNote) {
	for index, note := range notes {
		if index == shownNotes {
			c.Warnings = append(c.Warnings, fmt.Sprintf(messageScriptMore, label, stage, len(notes)-shownNotes))
			return
		}
		if c.postman.reported >= maxScriptNotes {
			return
		}
		c.postman.reported++
		c.Warnings = append(c.Warnings, fmt.Sprintf(messageScriptLine, label, stage, note.line, note.text))
	}
}

func (c *collector) summarizeScripts(name string) {
	if c.postman.translated+c.postman.failed == 0 {
		return
	}
	c.Warnings = append(c.Warnings, fmt.Sprintf(messageScriptTotals, name, c.postman.translated, c.postman.failed))
	c.postman.translated, c.postman.failed = 0, 0
}
