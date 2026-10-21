import { useEffect, useState } from "react"
import { Keyboard } from "lucide-react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { SectionLabel } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { Select } from "./ui/select"
import { useAppStore } from "../store/appStore"
import {
  DENSITIES, EDITOR_FONT_SIZES, LANGUAGES, REQUEST_TIMEOUT_SECONDS, RESPONSE_LAYOUTS, THEMES,
  resetPreferences, updatePreferences, usePreferences,
} from "../lib/preferences"
import { PREFERENCES_TEXT } from "../lib/preferencesText"

const { fields, sections } = PREFERENCES_TEXT

const optionsOf = (values, labels) => values.map((value) => ({ value, label: labels[value] }))

function PreferenceRow({ label, hint, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
      <span className="min-w-0 flex-1 basis-40 text-xs">
        {label}
        {hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>}
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

function ChoiceRow({ label, name, values, labels, preferences }) {
  return (
    <PreferenceRow label={label}>
      <SegmentedControl
        label={label}
        options={optionsOf(values, labels)}
        value={preferences[name]}
        onChange={(value) => updatePreferences({ [name]: value })}
      />
    </PreferenceRow>
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

function FlagRow({ label, name, preferences }) {
  return (
    <Checkbox
      checked={preferences[name]}
      onChange={(event) => updatePreferences({ [name]: event.target.checked })}
      className="h-auto min-h-6 justify-start py-0.5 text-left text-xs text-foreground"
    >
      {label}
    </Checkbox>
  )
}

export function PreferencesDialog({ onClose }) {
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
          <ChoiceRow label={fields.theme} name="theme" values={THEMES} labels={PREFERENCES_TEXT.themes} preferences={preferences} />
          <ChoiceRow label={fields.density} name="density" values={DENSITIES} labels={PREFERENCES_TEXT.densities} preferences={preferences} />
          <ChoiceRow label={fields.responseLayout} name="responseLayout" values={RESPONSE_LAYOUTS} labels={PREFERENCES_TEXT.layouts} preferences={preferences} />
        </Section>
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
