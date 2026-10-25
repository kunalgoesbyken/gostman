package importer

import (
	"strings"

	"github.com/kunalgoesbyken/gostman/locales"
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

func (c *collector) translateScript(d *dialect, label locales.Message, stage, source string) string {
	source, _ = withoutExportHeader(exportedTarget(d), source)
	return c.translateStripped(d, label, stage, source)
}

func (c *collector) translateAfterScript(d *dialect, label locales.Message, stage, source string) (string, []extractor, []assertion) {
	target := exportedTarget(d)
	source, _ = withoutExportHeader(target, source)
	source, rules := withoutExtractLines(target, source)
	source, rows := withoutCheckTests(target, source)
	return c.translateStripped(d, label, stage, source), rules, rows
}

func (c *collector) translateStripped(d *dialect, label locales.Message, stage, source string) string {
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

func placeLabel(kind, name string) locales.Message {
	code := locales.ImporterPlaceRequest
	switch kind {
	case labelCollection:
		code = locales.ImporterPlaceCollection
	case labelFolder:
		code = locales.ImporterPlaceFolder
	}
	return locales.New(code, locales.Params{"name": name})
}

func stageMessage(stage string) any {
	switch stage {
	case stagePre:
		return locales.New(locales.ImporterStagePre, nil)
	case stagePost:
		return locales.New(locales.ImporterStageTest, nil)
	case stageAfter:
		return locales.New(locales.ImporterStageAfter, nil)
	case stageChecks:
		return locales.New(locales.ImporterStageChecks, nil)
	}
	return stage
}

func (n scriptNote) param() any {
	if n.said != nil {
		return *n.said
	}
	return n.text
}

func (c *collector) reportNotes(d *dialect, label locales.Message, stage string, notes []scriptNote) {
	for index, note := range notes {
		if index == shownNotes {
			c.warn(RemarkScripts, locales.New(locales.ImporterScriptMore, locales.Params{"tool": d.name, "label": label, "stage": stageMessage(stage), "count": len(notes) - shownNotes}))
			return
		}
		if c.scripts.reported >= maxScriptNotes {
			return
		}
		c.scripts.reported++
		c.warn(RemarkScripts, locales.New(locales.ImporterScriptLine, locales.Params{"tool": d.name, "label": label, "stage": stageMessage(stage), "line": note.line, "note": note.param()}))
	}
}

func (c *collector) summarizeScripts(d *dialect, name string) {
	tally := c.scripts
	c.scripts.translated, c.scripts.failed, c.scripts.checks = 0, 0, 0
	if tally.checks > 0 && !c.inPlace {
		c.note(RemarkScripts, locales.New(locales.ImporterScriptChecks, locales.Params{"count": tally.checks, "name": name}))
	}
	if tally.translated+tally.failed == 0 || (c.inPlace && tally.failed == 0) {
		return
	}
	if tally.failed == 0 {
		c.note(RemarkScripts, locales.New(locales.ImporterScriptRewritten, locales.Params{"tool": d.name, "name": name, "count": tally.translated, "api": d.api}))
		return
	}
	if tally.translated == 0 {
		c.warn(RemarkScripts, locales.New(locales.ImporterScriptLeft, locales.Params{"tool": d.name, "name": name, "count": tally.failed, "api": d.api}))
		return
	}
	c.warn(RemarkScripts, locales.New(locales.ImporterScriptTotals, locales.Params{"tool": d.name, "name": name, "count": tally.translated, "api": d.api, "failed": tally.failed}))
}
