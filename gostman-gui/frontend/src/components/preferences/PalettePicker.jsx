import { Check } from "lucide-react"
import { PreferenceGroup } from "./PreferenceRows"
import { RADIO_KEYS } from "../ui/segmented"
import { updatePreferences } from "../../lib/preferences"
import { PREFERENCES_TEXT } from "../../lib/preferencesText"
import { moveFocus, tabStopOf } from "../../lib/rovingFocus"
import { EMPTY_CUSTOM_COLORS, MODES, PALETTE_IDS, effectiveColors } from "../../lib/themes"
import { cn } from "../../lib/utils"

const TEXT = PREFERENCES_TEXT.theme

function PaletteSample({ palette, mode }) {
  const theme = { palette, customColors: EMPTY_CUSTOM_COLORS }
  const page = effectiveColors(theme, mode, "window")
  const sidebar = effectiveColors(theme, mode, "sidebar")

  return (
    <span className="flex flex-1" style={{ backgroundColor: page.background }}>
      <span className="w-1/3" style={{ backgroundColor: sidebar.background }} />
      <span className="flex flex-1 flex-col justify-center gap-1 px-1.5">
        <span className="h-1 w-3/4 rounded-full" style={{ backgroundColor: page.foreground }} />
        <span className="h-1 w-1/2 rounded-full opacity-40" style={{ backgroundColor: page.foreground }} />
      </span>
    </span>
  )
}

function PaletteOption({ palette, isSelected, isTabStop }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      tabIndex={isTabStop ? 0 : -1}
      onClick={() => updatePreferences({ palette })}
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-md border p-1.5 text-left",
        isSelected ? "border-primary" : "border-border hover:bg-accent"
      )}
    >
      <span aria-hidden="true" className="flex h-10 overflow-hidden rounded border border-border">
        {MODES.map((mode) => <PaletteSample key={mode} palette={palette} mode={mode} />)}
      </span>
      <span className="flex items-center gap-1 text-xs">
        <span className="truncate">{TEXT.palettes[palette]}</span>
        {isSelected && <Check aria-hidden="true" className="h-3 w-3 shrink-0 text-primary" />}
      </span>
    </button>
  )
}

export function PalettePicker({ preferences }) {
  const tabStop = tabStopOf(PALETTE_IDS, preferences.palette)

  return (
    <PreferenceGroup title={TEXT.palette} hint={TEXT.paletteHint}>
      <div
        role="radiogroup"
        aria-label={TEXT.palette}
        onKeyDown={(event) => moveFocus(event, RADIO_KEYS)}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {PALETTE_IDS.map((palette) => (
          <PaletteOption key={palette} palette={palette} isSelected={palette === preferences.palette} isTabStop={palette === tabStop} />
        ))}
      </div>
    </PreferenceGroup>
  )
}
