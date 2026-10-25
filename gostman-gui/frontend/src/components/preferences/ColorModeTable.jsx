import { useState } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { ColorField } from "./ColorField"
import { PreferenceGroup, optionsOf } from "./PreferenceRows"
import { Button, IconButton } from "../ui/button"
import { SegmentedControl } from "../ui/segmented"
import { MIN_TEXT_CONTRAST, contrastRatio } from "../../lib/color"
import { formatNumber } from "../../lib/i18n/format"
import { updatePreferences, useResolvedTheme } from "../../lib/preferences"
import { PREFERENCES_TEXT } from "../../lib/preferencesText"
import { MODES, withSurfaceColor, withoutMode, withoutSurface } from "../../lib/themes"

const TEXT = PREFERENCES_TEXT.theme
const modeOptions = () => optionsOf(MODES, PREFERENCES_TEXT.themes)
const ONE_DECIMAL = { minimumFractionDigits: 1, maximumFractionDigits: 1 }
const HEADER = "whitespace-nowrap pb-1.5 pe-3 text-start text-2xs font-medium uppercase tracking-wide text-muted-foreground"
const CELL = "py-2 pe-3"

const roundedDown = (ratio) => Math.floor(ratio * 10) / 10

function ContrastValue({ ratio }) {
  const text = TEXT.ratio(formatNumber(roundedDown(ratio), ONE_DECIMAL))
  if (ratio >= MIN_TEXT_CONTRAST) return <span className="font-mono text-2xs text-muted-foreground">{text}</span>
  const warning = TEXT.lowContrast(formatNumber(MIN_TEXT_CONTRAST, ONE_DECIMAL))

  return (
    <span title={warning} className="inline-flex items-center gap-1 font-mono text-2xs text-warning">
      <AlertTriangle aria-hidden="true" className="h-3 w-3 shrink-0" />
      {text}
      <span className="sr-only">{warning}</span>
    </span>
  )
}

function ColorRow({ row, roles, custom, onColor, onReset }) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <th scope="row" className={`${CELL} text-start font-normal`}>{row.sample}</th>
      {roles.map((role) => (
        <td key={role} className={CELL}>
          <ColorField
            label={TEXT.colorLabel(row.name, TEXT.roles[role])}
            hexLabel={TEXT.hexLabel(row.name, TEXT.roles[role])}
            value={row.colors[role]}
            isCustom={Boolean(custom?.[role])}
            onChange={(value) => onColor(role, value)}
          />
        </td>
      ))}
      <td className={`${CELL} whitespace-nowrap`}>
        <ContrastValue ratio={contrastRatio(row.colors.background, row.colors.foreground)} />
      </td>
      <td className="py-2 text-end">
        <IconButton label={TEXT.resetRow(row.name)} icon={RotateCcw} size="icon-xs" disabled={!custom} onClick={onReset} />
      </td>
    </tr>
  )
}

export function ColorModeTable({ title, hint, nameColumn, colorKey, roles, preferences, rowsFor, resetModeLabel }) {
  const resolvedMode = useResolvedTheme()
  const [mode, setMode] = useState(resolvedMode)
  const colors = preferences[colorKey]
  const update = (next) => updatePreferences({ [colorKey]: next })

  return (
    <PreferenceGroup
      title={title}
      hint={hint}
      action={<SegmentedControl label={TEXT.editing} options={modeOptions()} value={mode} onChange={setMode} />}
    >
      {mode !== resolvedMode && <p role="status" className="text-2xs text-muted-foreground">{TEXT.previewHint[mode]}</p>}
      <div className="overflow-x-auto">
        <table aria-label={title} className="w-full min-w-[30rem] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={HEADER}>{nameColumn}</th>
              {roles.map((role) => <th key={role} scope="col" className={HEADER}>{TEXT.columns[role]}</th>)}
              <th scope="col" className={HEADER}>{TEXT.columns.contrast}</th>
              <th scope="col" className="pb-1.5"><span className="sr-only">{TEXT.columns.reset}</span></th>
            </tr>
          </thead>
          <tbody>
            {rowsFor(mode).map((row) => (
              <ColorRow
                key={row.id}
                row={row}
                roles={roles}
                custom={colors[mode][row.id]}
                onColor={(role, value) => update(withSurfaceColor(colors, mode, row.id, role, value))}
                onReset={() => update(withoutSurface(colors, mode, row.id))}
              />
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" disabled={Object.keys(colors[mode]).length === 0} onClick={() => update(withoutMode(colors, mode))}>
        <RotateCcw />
        {resetModeLabel[mode]}
      </Button>
    </PreferenceGroup>
  )
}
