import { useId } from "react"
import { CustomColorSwatch } from "../ui/colorPicker"
import { RADIO_KEYS, SegmentedControl } from "../ui/segmented"
import { CUSTOM_ACCENT, accentShade } from "../../lib/accent"
import { ACCENTS, updatePreferences } from "../../lib/preferences"
import { PREFERENCES_TEXT } from "../../lib/preferencesText"
import { moveFocus, tabStopOf } from "../../lib/rovingFocus"
import { MODES } from "../../lib/themes"
import { cn } from "../../lib/utils"

export const optionsOf = (values, labels) => values.map((value) => ({ value, label: labels[value] }))

export function PreferenceGroup({ title, hint, action, children }) {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <h4 id={titleId} className="text-xs font-semibold">{title}</h4>
          {hint && <p className="mt-0.5 text-2xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function PreferenceRow({ label, hint, children }) {
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

export function ChoiceRow({ label, hint, name, options, preferences }) {
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

const ACCENT_OPTIONS = [...ACCENTS, CUSTOM_ACCENT]

function adjustedShades(preferences) {
  if (preferences.accent !== CUSTOM_ACCENT) return null
  const shades = Object.fromEntries(MODES.map((mode) => [mode, accentShade(preferences, mode, preferences.accentColor)]))
  return Object.values(shades).some((shade) => shade !== preferences.accentColor) ? shades : null
}

export function AccentRow({ preferences }) {
  const tabStop = tabStopOf(ACCENT_OPTIONS, preferences.accent)
  const isCustom = preferences.accent === CUSTOM_ACCENT
  const shades = adjustedShades(preferences)

  return (
    <PreferenceRow label={PREFERENCES_TEXT.fields.accent} hint={shades && PREFERENCES_TEXT.accentAdjusted(shades)}>
      <div role="radiogroup" aria-label={PREFERENCES_TEXT.fields.accent} onKeyDown={(event) => moveFocus(event, RADIO_KEYS)} className="flex items-center gap-1.5">
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
        <CustomColorSwatch
          value={isCustom ? preferences.accentColor : ""}
          isSelected={isCustom}
          isTabStop={tabStop === CUSTOM_ACCENT}
          size="md"
          onChange={(accentColor) => updatePreferences({ accent: CUSTOM_ACCENT, accentColor })}
        />
      </div>
    </PreferenceRow>
  )
}
