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
	source, _ = withoutExportHeader(exportedTarget(d), source)
	return c.translateStripped(d, label, stage, source)
}

func (c *collector) translateAfterScript(d *dialect, label, stage, source string) (string, []extractor, []assertion) {
	target := exportedTarget(d)
	source, _ = withoutExportHeader(target, source)
	source, rules := withoutExtractLines(target, source)
	source, rows := withoutCheckTests(target, source)
	return c.translateStripped(d, label, stage, source), rules, rows
}

func (c *collector) translateStripped(d *dialect, label, stage, source string) string {
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
	tally := c.scripts
	c.scripts.translated, c.scripts.failed = 0, 0
	if tally.translated+tally.failed == 0 || (c.inPlace && tally.failed == 0) {
		return
	}
	if tally.failed == 0 {
		c.Notes = append(c.Notes, fmt.Sprintf(messageScriptsRewritten, d.name, name, uses(tally.translated), d.api))
		return
	}
	c.Warnings = append(c.Warnings, fmt.Sprintf(messageScriptTotals, d.name, name, uses(tally.translated), d.api, tally.failed))
}

func uses(count int) string {
	if count == 1 {
		return "1 use"
	}
	return fmt.Sprintf("%d uses", count)
}
