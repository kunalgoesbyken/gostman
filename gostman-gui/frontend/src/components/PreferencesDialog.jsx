import { useEffect, useId, useRef, useState } from "react"
import { Keyboard } from "lucide-react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Combobox } from "./ui/combobox"
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { SPLIT_LIST, SPLIT_PANES } from "./ui/panel"
import { Select } from "./ui/select"
import { DataSection } from "./preferences/DataSection"
import { ChoiceRow, PreferenceRow, optionsOf } from "./preferences/PreferenceRows"
import { ThemeSection } from "./preferences/ThemeSection"
import { useAppStore } from "../store/appStore"
import { awaitsRestart, useWindowFrame } from "../hooks/useWindowFrame"
import { isFontInstalled, sortedFamilies } from "../lib/fonts"
import { ORIENTATION, moveFocus } from "../lib/rovingFocus"
import { scrollIntoStrip } from "../lib/scrollIntoStrip"
import { readStored, writeStored } from "../lib/storage"
import {
  DENSITIES, EDITOR_FONT_SIZES, FONT_NAME_LENGTH, LANGUAGES, REQUEST_TIMEOUT_SECONDS, RESPONSE_LAYOUTS,
  TEXT_SCALES, resetPreferences, updatePreferences, usePreferences,
} from "../lib/preferences"
import { PREFERENCES_TEXT } from "../lib/preferencesText"
import { cn } from "../lib/utils"

const { fields, sections } = PREFERENCES_TEXT

const PREFERENCES_WINDOW = { id: "preferences", width: 760, height: 560, minWidth: 560, minHeight: 360 }
const SECTION_STORAGE_KEY = "gostman.preferencesSection"
const SECTION_KEYS = { selector: "[role=tab]", orientation: ORIENTATION.both, activate: true }

function FontRow({ label, hint, name, isCode, suggestions, preferences }) {
  const saved = preferences[name]
  const [draft, setDraft] = useState(saved)
  const isMissing = saved !== "" && !isFontInstalled(saved)

  useEffect(() => setDraft(saved), [saved])

  const change = (event) => {
    setDraft(event.target.value)
    updatePreferences({ [name]: event.target.value.trim() })
  }

  return (
    <PreferenceRow label={label} hint={isMissing ? PREFERENCES_TEXT.fontMissing : hint}>
      <Combobox
        aria-label={label}
        aria-invalid={isMissing}
        suggestions={suggestions}
        maxLength={FONT_NAME_LENGTH}
        spellCheck={false}
        placeholder={PREFERENCES_TEXT.defaultFont}
        value={draft}
        onChange={change}
        onBlur={() => setDraft(saved)}
        className={cn("w-48", isCode && "font-mono")}
      />
    </PreferenceRow>
  )
}

function useInstalledFonts(listFonts) {
  const [fonts, setFonts] = useState([])
  const [status, setStatus] = useState("")

  const load = () =>
    listFonts()
      .then((families) => {
        setFonts(sortedFamilies(families))
        setStatus(PREFERENCES_TEXT.fontsSuggested)
      })
      .catch(() => setStatus(PREFERENCES_TEXT.fontsDenied))

  return { fonts, status, load: listFonts ? load : null }
}

const isWithin = ({ min, max }, number) => Number.isInteger(number) && number >= min && number <= max

function NumberRow({ label, hint, suffix, range, value, onCommit }) {
  const [draft, setDraft] = useState(String(value))
  const isValid = draft.trim() !== "" && isWithin(range, Number(draft))

  useEffect(() => setDraft(String(value)), [value])

  const change = (event) => {
    setDraft(event.target.value)
    const number = Number(event.target.value)
    if (event.target.value.trim() !== "" && isWithin(range, number)) onCommit(number)
  }

  return (
    <PreferenceRow label={label} hint={hint}>
      <span className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          aria-label={label}
          aria-invalid={!isValid}
          min={range.min}
          max={range.max}
          value={draft}
          onChange={change}
          onBlur={() => setDraft(String(value))}
          className="w-20"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </span>
    </PreferenceRow>
  )
}

const FLAG_CLASS = "h-auto min-h-6 justify-start py-0.5 text-left text-xs text-foreground"

function FlagRow({ label, name, preferences }) {
  return (
    <Checkbox checked={preferences[name]} onChange={(event) => updatePreferences({ [name]: event.target.checked })} className={FLAG_CLASS}>
      {label}
    </Checkbox>
  )
}

const titleBarHint = (frame, failed) => {
  if (failed) return PREFERENCES_TEXT.systemTitleBarFailed
  if (awaitsRestart(frame)) return PREFERENCES_TEXT.systemTitleBarRestart
  return PREFERENCES_TEXT.systemTitleBarHint
}

function SystemTitleBarRow({ windowFrame }) {
  const frame = useWindowFrame(windowFrame)
  const [failed, setFailed] = useState(false)
  const hintId = useId()
  if (!frame?.adjustable) return null

  const change = (event) => {
    setFailed(false)
    windowFrame.setSystemTitleBar(event.target.checked).catch(() => setFailed(true))
  }

  return (
    <div>
      <Checkbox checked={frame.systemTitleBar} onChange={change} aria-describedby={hintId} className={FLAG_CLASS}>
        {fields.systemTitleBar}
      </Checkbox>
      <p id={hintId} role="status" className="pl-[1.375rem] text-2xs text-muted-foreground">{titleBarHint(frame, failed)}</p>
    </div>
  )
}

const percentLabels = (language) => {
  const format = new Intl.NumberFormat(language, { style: "percent" })
  return TEXT_SCALES.map((scale) => ({ value: scale, label: format.format(scale / 100) }))
}

function AppearanceSection({ preferences, windowFrame }) {
  return (
    <>
      <ChoiceRow label={fields.textScale} name="textScale" options={percentLabels(preferences.language)} preferences={preferences} />
      <ChoiceRow label={fields.density} name="density" options={optionsOf(DENSITIES, PREFERENCES_TEXT.densities)} preferences={preferences} />
      <ChoiceRow label={fields.responseLayout} name="responseLayout" options={optionsOf(RESPONSE_LAYOUTS, PREFERENCES_TEXT.layouts)} preferences={preferences} />
      <SystemTitleBarRow windowFrame={windowFrame} />
    </>
  )
}

function FontsSection({ preferences, installedFonts }) {
  return (
    <>
      <FontRow label={fields.interfaceFont} hint={PREFERENCES_TEXT.interfaceFontHint} name="interfaceFont" suggestions={installedFonts.fonts} preferences={preferences} />
      <FontRow label={fields.codeFont} hint={PREFERENCES_TEXT.codeFontHint} name="codeFont" isCode suggestions={installedFonts.fonts} preferences={preferences} />
      {installedFonts.load && installedFonts.fonts.length === 0 && (
        <Button variant="outline" size="sm" onClick={installedFonts.load}>{PREFERENCES_TEXT.suggestFonts}</Button>
      )}
      {installedFonts.status && <p role="status" className="text-2xs text-muted-foreground">{installedFonts.status}</p>}
    </>
  )
}

function EditorSection({ preferences }) {
  return (
    <>
      <NumberRow
        label={fields.editorFontSize}
        range={EDITOR_FONT_SIZES}
        value={preferences.editorFontSize}
        onCommit={(editorFontSize) => updatePreferences({ editorFontSize })}
      />
      <FlagRow label={fields.wrapLines} name="wrapLines" preferences={preferences} />
    </>
  )
}

function RequestsSection({ preferences }) {
  return (
    <>
      <NumberRow
        label={fields.requestTimeout}
        hint={PREFERENCES_TEXT.timeoutHint}
        suffix={PREFERENCES_TEXT.seconds}
        range={REQUEST_TIMEOUT_SECONDS}
        value={preferences.requestTimeoutSeconds}
        onCommit={(requestTimeoutSeconds) => updatePreferences({ requestTimeoutSeconds })}
      />
      <FlagRow label={fields.confirmCloseTab} name="confirmCloseTab" preferences={preferences} />
    </>
  )
}

function LanguageSection({ preferences }) {
  return (
    <PreferenceRow label={fields.language} hint={PREFERENCES_TEXT.languageHint}>
      <div className="w-40 max-w-full">
        <Select aria-label={fields.language} value={preferences.language} onChange={(event) => updatePreferences({ language: event.target.value })}>
          {LANGUAGES.map((language) => (
            <option key={language.value} value={language.value}>{PREFERENCES_TEXT.languages[language.value]}</option>
          ))}
        </Select>
      </div>
    </PreferenceRow>
  )
}

const SECTIONS = [
  { id: "appearance", title: sections.appearance, render: (context) => <AppearanceSection {...context} /> },
  { id: "theme", title: sections.theme, render: (context) => <ThemeSection {...context} /> },
  { id: "fonts", title: sections.fonts, render: (context) => <FontsSection {...context} /> },
  { id: "editor", title: sections.editor, render: (context) => <EditorSection {...context} /> },
  { id: "requests", title: sections.requests, render: (context) => <RequestsSection {...context} /> },
  { id: "language", title: sections.language, render: (context) => <LanguageSection {...context} /> },
  { id: "data", title: sections.data, render: (context) => <DataSection {...context} /> },
]

const sectionById = (id) => SECTIONS.find((section) => section.id === id) ?? SECTIONS[0]

const rememberedSectionId = () => sectionById(readStored(SECTION_STORAGE_KEY)).id

function SectionTab({ section, isSelected, tabId, panelId, onSelect }) {
  const tabRef = useRef(null)

  useEffect(() => {
    if (isSelected) scrollIntoStrip(tabRef.current)
  }, [isSelected])

  return (
    <button
      ref={tabRef}
      type="button"
      role="tab"
      id={tabId}
      aria-selected={isSelected}
      aria-controls={isSelected ? panelId : undefined}
      tabIndex={isSelected ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "flex h-8 shrink-0 items-center whitespace-nowrap rounded-md px-2.5 text-left text-xs",
        isSelected ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {section.title}
    </button>
  )
}

export function PreferencesDialog({ listFonts, windowFrame, onCommand, onClose }) {
  const preferences = usePreferences()
  const installedFonts = useInstalledFonts(listFonts)
  const openShortcuts = useAppStore((state) => state.openShortcutsDialog)
  const [selectedId, setSelectedId] = useState(rememberedSectionId)
  const selected = sectionById(selectedId)
  const baseId = useId()
  const tabIdOf = (section) => `${baseId}-${section.id}-tab`
  const panelId = `${baseId}-panel`

  const select = (id) => {
    setSelectedId(id)
    writeStored(SECTION_STORAGE_KEY, id)
  }

  const showShortcuts = () => {
    onClose()
    openShortcuts()
  }

  return (
    <Dialog label={PREFERENCES_TEXT.title} size="lg" floating={PREFERENCES_WINDOW} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{PREFERENCES_TEXT.title}</DialogTitle>
      </DialogHeader>
      <div className={SPLIT_PANES}>
        <div
          role="tablist"
          aria-label={PREFERENCES_TEXT.sectionsLabel}
          aria-orientation="vertical"
          onKeyDown={(event) => moveFocus(event, SECTION_KEYS)}
          className={cn(SPLIT_LIST, "w-44 gap-0.5 overflow-y-auto p-2 max-sm:flex-row max-sm:overflow-x-auto max-sm:scrollbar-none")}
        >
          {SECTIONS.map((section) => (
            <SectionTab
              key={section.id}
              section={section}
              isSelected={section.id === selected.id}
              tabId={tabIdOf(section)}
              panelId={panelId}
              onSelect={() => select(section.id)}
            />
          ))}
        </div>
        <div
          key={selected.id}
          role="tabpanel"
          id={panelId}
          aria-labelledby={tabIdOf(selected)}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 [overflow-wrap:anywhere] max-sm:p-4"
        >
          <h3 className="mb-5 text-sm font-semibold">{selected.title}</h3>
          <div className="space-y-4">{selected.render({ preferences, windowFrame, installedFonts, onCommand })}</div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" className="mr-auto" onClick={showShortcuts}>
          <Keyboard />
          <span className="max-sm:sr-only">{PREFERENCES_TEXT.shortcuts}</span>
        </Button>
        <Button variant="outline" onClick={resetPreferences}>{PREFERENCES_TEXT.reset}</Button>
        <Button onClick={onClose}>{PREFERENCES_TEXT.close}</Button>
      </DialogFooter>
    </Dialog>
  )
}
