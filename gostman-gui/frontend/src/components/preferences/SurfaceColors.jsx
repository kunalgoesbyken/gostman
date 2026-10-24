import { useMemo, useState } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { ColorField } from "./ColorField"
import { PreferenceGroup, optionsOf } from "./PreferenceRows"
import { Button, IconButton } from "../ui/button"
import { SegmentedControl } from "../ui/segmented"
import { MIN_TEXT_CONTRAST, contrastRatio } from "../../lib/color"
import { updatePreferences, useResolvedTheme } from "../../lib/preferences"
import { PREFERENCES_TEXT } from "../../lib/preferencesText"
import { MODES, ROLES, SURFACES, effectiveColors, withSurfaceColor, withoutMode, withoutSurface } from "../../lib/themes"

const TEXT = PREFERENCES_TEXT.theme
const MODE_OPTIONS = optionsOf(MODES, PREFERENCES_TEXT.themes)
const HEADER = "whitespace-nowrap pb-1.5 pr-3 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground"
const CELL = "py-2 pr-3"

const roundedDown = (ratio) => Math.floor(ratio * 10) / 10

function ContrastValue({ ratio, format }) {
  const text = TEXT.ratio(format.format(roundedDown(ratio)))
  if (ratio >= MIN_TEXT_CONTRAST) return <span className="font-mono text-2xs text-muted-foreground">{text}</span>
  const warning = TEXT.lowContrast(format.format(MIN_TEXT_CONTRAST))

  return (
    <span title={warning} className="inline-flex items-center gap-1 font-mono text-2xs text-warning">
      <AlertTriangle aria-hidden="true" className="h-3 w-3 shrink-0" />
      {text}
      <span className="sr-only">{warning}</span>
    </span>
  )
}

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

function SurfaceRow({ id, preferences, mode, format, onColor, onReset }) {
  const name = TEXT.surfaces[id]
  const colors = effectiveColors(preferences, mode, id)
  const custom = preferences.customColors[mode][id]

  return (
    <tr className="border-b border-border last:border-b-0">
      <th scope="row" className={`${CELL} text-left font-normal`}>
        <SurfaceName name={name} hint={TEXT.surfaceHints[id]} colors={colors} />
      </th>
      {ROLES.map((role) => (
        <td key={role} className={CELL}>
          <ColorField
            label={TEXT.colorLabel(name, TEXT.roles[role])}
            hexLabel={TEXT.hexLabel(name, TEXT.roles[role])}
            value={colors[role]}
            isCustom={Boolean(custom?.[role])}
            onChange={(value) => onColor(id, role, value)}
          />
        </td>
      ))}
      <td className={`${CELL} whitespace-nowrap`}>
        <ContrastValue ratio={contrastRatio(colors.background, colors.foreground)} format={format} />
      </td>
      <td className="py-2 text-right">
        <IconButton label={TEXT.resetSurface(name)} icon={RotateCcw} size="icon-xs" disabled={!custom} onClick={() => onReset(id)} />
      </td>
    </tr>
  )
}

export function SurfaceColors({ preferences }) {
  const resolvedMode = useResolvedTheme()
  const [mode, setMode] = useState(resolvedMode)
  const format = useMemo(() => new Intl.NumberFormat(preferences.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), [preferences.language])
  const { customColors } = preferences
  const hasCustom = Object.keys(customColors[mode]).length > 0

  const setColor = (id, role, value) => updatePreferences({ customColors: withSurfaceColor(customColors, mode, id, role, value) })
  const resetSurface = (id) => updatePreferences({ customColors: withoutSurface(customColors, mode, id) })
  const resetMode = () => updatePreferences({ customColors: withoutMode(customColors, mode) })

  return (
    <PreferenceGroup
      title={TEXT.colors}
      hint={TEXT.colorsHint}
      action={<SegmentedControl label={TEXT.editing} options={MODE_OPTIONS} value={mode} onChange={setMode} />}
    >
      {mode !== resolvedMode && <p role="status" className="text-2xs text-muted-foreground">{TEXT.previewHint[mode]}</p>}
      <div className="overflow-x-auto">
        <table aria-label={TEXT.colors} className="w-full min-w-[30rem] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={HEADER}>{TEXT.columns.surface}</th>
              <th scope="col" className={HEADER}>{TEXT.columns.background}</th>
              <th scope="col" className={HEADER}>{TEXT.columns.foreground}</th>
              <th scope="col" className={HEADER}>{TEXT.columns.contrast}</th>
              <th scope="col" className="pb-1.5"><span className="sr-only">{TEXT.columns.reset}</span></th>
            </tr>
          </thead>
          <tbody>
            {SURFACES.map(({ id }) => (
              <SurfaceRow key={id} id={id} preferences={preferences} mode={mode} format={format} onColor={setColor} onReset={resetSurface} />
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" disabled={!hasCustom} onClick={resetMode}>
        <RotateCcw />
        {TEXT.resetMode[mode]}
      </Button>
    </PreferenceGroup>
  )
}
