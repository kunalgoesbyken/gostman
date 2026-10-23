import { useEffect, useId, useState } from "react"
import { Keyboard } from "lucide-react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Combobox } from "./ui/combobox"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { SectionLabel } from "./ui/panel"
import { RADIO_KEYS, SegmentedControl } from "./ui/segmented"
import { Select } from "./ui/select"
import { useAppStore } from "../store/appStore"
import { awaitsRestart, useWindowFrame } from "../hooks/useWindowFrame"
import { isFontInstalled, sortedFamilies } from "../lib/fonts"
import { moveFocus, tabStopOf } from "../lib/rovingFocus"
import {
  ACCENTS, CONTRASTS, DENSITIES, EDITOR_FONT_SIZES, FONT_NAME_LENGTH, LANGUAGES, REQUEST_TIMEOUT_SECONDS, RESPONSE_LAYOUTS,
  TEXT_SCALES, THEMES, resetPreferences, updatePreferences, usePreferences,
} from "../lib/preferences"
import { PREFERENCES_TEXT } from "../lib/preferencesText"
import { cn } from "../lib/utils"

const { fields, sections } = PREFERENCES_TEXT

const optionsOf = (values, labels) => values.map((value) => ({ value, label: labels[value] }))

function PreferenceRow({ label, hint, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
      <span className="min-w-0 flex-1 basis-40 text-xs">
        {label}
        {hint && <span className="mt-0.5 block text-2xs text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section aria-label={title} className="space-y-3">
      <SectionLabel className="block">{title}</SectionLabel>
      {children}
    </section>
  )
}

function ChoiceRow({ label, hint, name, options, preferences }) {
  return (
    <PreferenceRow label={label} hint={hint}>
      <SegmentedControl
        label={label}
        options={options}
        value={preferences[name]}
        onChange={(value) => updatePreferences({ [name]: value })}
      />
    </PreferenceRow>
  )
}

function AccentRow({ preferences }) {
  const tabStop = tabStopOf(ACCENTS, preferences.accent)

  return (
    <PreferenceRow label={fields.accent}>
      <div role="radiogroup" aria-label={fields.accent} onKeyDown={(event) => moveFocus(event, RADIO_KEYS)} className="flex items-center gap-1.5">
        {ACCENTS.map((accent) => (
          <button
            key={accent}
            type="button"
            role="radio"
            aria-checked={preferences.accent === accent}
            aria-label={PREFERENCES_TEXT.accents[accent]}
            tabIndex={accent === tabStop ? 0 : -1}
            title={PREFERENCES_TEXT.accents[accent]}
            data-accent={accent}
            onClick={() => updatePreferences({ accent })}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full",
              preferences.accent === accent && "ring-1 ring-foreground ring-offset-1 ring-offset-background"
            )}
          >
            <span aria-hidden="true" className="h-4 w-4 rounded-full bg-primary" />
          </button>
        ))}
      </div>
    </PreferenceRow>
  )
}

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

  return { fonts, status, load }
}

function FontsSection({ preferences, listFonts }) {
  const installed = useInstalledFonts(listFonts)

  return (
    <Section title={sections.fonts}>
      <FontRow label={fields.interfaceFont} hint={PREFERENCES_TEXT.interfaceFontHint} name="interfaceFont" suggestions={installed.fonts} preferences={preferences} />
      <FontRow label={fields.codeFont} hint={PREFERENCES_TEXT.codeFontHint} name="codeFont" isCode suggestions={installed.fonts} preferences={preferences} />
      {listFonts && installed.fonts.length === 0 && (
        <Button variant="outline" size="sm" onClick={installed.load}>{PREFERENCES_TEXT.suggestFonts}</Button>
      )}
      {installed.status && <p role="status" className="text-2xs text-muted-foreground">{installed.status}</p>}
    </Section>
  )
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

export function PreferencesDialog({ listFonts, windowFrame, onClose }) {
  const preferences = usePreferences()
  const openShortcuts = useAppStore((state) => state.openShortcutsDialog)

  const showShortcuts = () => {
    onClose()
    openShortcuts()
  }

  return (
    <Dialog label={PREFERENCES_TEXT.title} className="max-w-lg" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{PREFERENCES_TEXT.title}</DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-6">
        <Section title={sections.appearance}>
          <ChoiceRow label={fields.theme} name="theme" options={optionsOf(THEMES, PREFERENCES_TEXT.themes)} preferences={preferences} />
          <ChoiceRow
            label={fields.contrast}
            hint={PREFERENCES_TEXT.contrastHint}
            name="contrast"
            options={optionsOf(CONTRASTS, PREFERENCES_TEXT.contrasts)}
            preferences={preferences}
          />
          <AccentRow preferences={preferences} />
          <ChoiceRow label={fields.textScale} name="textScale" options={percentLabels(preferences.language)} preferences={preferences} />
          <ChoiceRow label={fields.density} name="density" options={optionsOf(DENSITIES, PREFERENCES_TEXT.densities)} preferences={preferences} />
          <ChoiceRow label={fields.responseLayout} name="responseLayout" options={optionsOf(RESPONSE_LAYOUTS, PREFERENCES_TEXT.layouts)} preferences={preferences} />
          <SystemTitleBarRow windowFrame={windowFrame} />
        </Section>
        <FontsSection preferences={preferences} listFonts={listFonts} />
        <Section title={sections.editor}>
          <NumberRow
            label={fields.editorFontSize}
            range={EDITOR_FONT_SIZES}
            value={preferences.editorFontSize}
            onCommit={(editorFontSize) => updatePreferences({ editorFontSize })}
          />
          <FlagRow label={fields.wrapLines} name="wrapLines" preferences={preferences} />
        </Section>
        <Section title={sections.requests}>
          <NumberRow
            label={fields.requestTimeout}
            hint={PREFERENCES_TEXT.timeoutHint}
            suffix={PREFERENCES_TEXT.seconds}
            range={REQUEST_TIMEOUT_SECONDS}
            value={preferences.requestTimeoutSeconds}
            onCommit={(requestTimeoutSeconds) => updatePreferences({ requestTimeoutSeconds })}
          />
          <FlagRow label={fields.confirmCloseTab} name="confirmCloseTab" preferences={preferences} />
        </Section>
        <Section title={sections.language}>
          <PreferenceRow label={fields.language} hint={PREFERENCES_TEXT.languageHint}>
            <div className="w-40 max-w-full">
              <Select aria-label={fields.language} value={preferences.language} onChange={(event) => updatePreferences({ language: event.target.value })}>
                {LANGUAGES.map((language) => (
                  <option key={language.value} value={language.value}>{PREFERENCES_TEXT.languages[language.value]}</option>
                ))}
              </Select>
            </div>
          </PreferenceRow>
        </Section>
        <Button variant="outline" onClick={showShortcuts}>
          <Keyboard />
          {PREFERENCES_TEXT.shortcuts}
        </Button>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={resetPreferences}>{PREFERENCES_TEXT.reset}</Button>
        <Button onClick={onClose}>{PREFERENCES_TEXT.close}</Button>
      </DialogFooter>
    </Dialog>
  )
}
