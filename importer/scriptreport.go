package importer

import (
	"fmt"
	"strings"
)

const (
	shownNotes         = 5
	maxScriptNotes     = 100
	stagePre           = "pre-request script"
	stagePost          = "test script"
	stageAfter         = "post-response script"
	labelCollection    = "collection %q"
	labelFolder        = "folder %q"
	labelRequest       = "request %q"
	labelOuterSettings = "Settings for all collections"
)

type scriptTally struct {
	translated int
	failed     int
	reported   int
	checks     int
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
			c.warn(RemarkScripts, fmt.Sprintf(messageScriptMore, d.name, label, stage, len(notes)-shownNotes))
			return
		}
		if c.scripts.reported >= maxScriptNotes {
			return
		}
		c.scripts.reported++
		c.warn(RemarkScripts, fmt.Sprintf(messageScriptLine, d.name, label, stage, note.line, note.text))
	}
}

func (c *collector) summarizeScripts(d *dialect, name string) {
	tally := c.scripts
	c.scripts.translated, c.scripts.failed, c.scripts.checks = 0, 0, 0
	if tally.checks > 0 && !c.inPlace {
		c.note(RemarkScripts, fmt.Sprintf(messageScriptChecks, assertionCount(tally.checks), name))
	}
	if tally.translated+tally.failed == 0 || (c.inPlace && tally.failed == 0) {
		return
	}
	if tally.failed == 0 {
		c.note(RemarkScripts, fmt.Sprintf(messageScriptsRewritten, d.name, name, uses(tally.translated), d.api))
		return
	}
	if tally.translated == 0 {
		c.warn(RemarkScripts, fmt.Sprintf(messageScriptsLeft, d.name, name, uses(tally.failed), d.api))
		return
	}
	c.warn(RemarkScripts, fmt.Sprintf(messageScriptTotals, d.name, name, uses(tally.translated), d.api, tally.failed))
}

func assertionCount(count int) string {
	if count == 1 {
		return "1 assertion"
	}
	return fmt.Sprintf("%d assertions", count)
}

func uses(count int) string {
	if count == 1 {
		return "1 use"
	}
	return fmt.Sprintf("%d uses", count)
}
