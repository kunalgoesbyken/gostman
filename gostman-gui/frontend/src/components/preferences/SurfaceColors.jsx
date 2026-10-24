import { ColorModeTable } from "./ColorModeTable"
import { PREFERENCES_TEXT } from "../../lib/preferencesText"
import { ROLES, SURFACES, effectiveColors } from "../../lib/themes"

const TEXT = PREFERENCES_TEXT.theme

function SurfaceName({ name, hint, colors }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border text-2xs font-semibold"
        style={{ backgroundColor: colors.background, color: colors.foreground }}
      >
        {TEXT.sample}
      </span>
      <span className="min-w-0">
        <span className="block">{name}</span>
        {hint && <span className="block text-2xs text-muted-foreground">{hint}</span>}
      </span>
    </span>
  )
}

function surfaceRow(preferences, mode, id) {
  const name = TEXT.surfaces[id]
  const colors = effectiveColors(preferences, mode, id)
  return { id, name, colors, sample: <SurfaceName name={name} hint={TEXT.surfaceHints[id]} colors={colors} /> }
}

export function SurfaceColors({ preferences }) {
  return (
    <ColorModeTable
      title={TEXT.colors}
      hint={TEXT.colorsHint}
      nameColumn={TEXT.columns.surface}
      colorKey="customColors"
      roles={ROLES}
      preferences={preferences}
      rowsFor={(mode) => SURFACES.map(({ id }) => surfaceRow(preferences, mode, id))}
      resetModeLabel={TEXT.resetMode}
    />
  )
}
