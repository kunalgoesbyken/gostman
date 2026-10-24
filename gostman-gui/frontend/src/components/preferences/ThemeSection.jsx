import { PalettePicker } from "./PalettePicker"
import { AccentRow, ChoiceRow, optionsOf } from "./PreferenceRows"
import { SurfaceColors } from "./SurfaceColors"
import { ThemeTransfer } from "./ThemeTransfer"
import { CONTRASTS, THEMES } from "../../lib/preferences"
import { PREFERENCES_TEXT } from "../../lib/preferencesText"

const { fields } = PREFERENCES_TEXT

export function ThemeSection({ preferences }) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <ChoiceRow label={fields.theme} name="theme" options={optionsOf(THEMES, PREFERENCES_TEXT.themes)} preferences={preferences} />
        <ChoiceRow
          label={fields.contrast}
          hint={PREFERENCES_TEXT.contrastHint}
          name="contrast"
          options={optionsOf(CONTRASTS, PREFERENCES_TEXT.contrasts)}
          preferences={preferences}
        />
        <AccentRow preferences={preferences} />
      </div>
      <PalettePicker preferences={preferences} />
      <SurfaceColors preferences={preferences} />
      <ThemeTransfer preferences={preferences} />
    </div>
  )
}
