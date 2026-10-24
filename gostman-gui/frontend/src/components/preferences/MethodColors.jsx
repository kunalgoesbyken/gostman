import { useMemo, useState } from "react"
import { RotateCcw } from "lucide-react"
import { ColorField } from "./ColorField"
import { PreferenceGroup } from "./PreferenceRows"
import { CELL, ContrastValue, HEADER, MODE_OPTIONS, useRatioFormat } from "./SurfaceColors"
import { Button, IconButton } from "../ui/button"
import { SegmentedControl } from "../ui/segmented"
import { contrastRatio, tripletToHex } from "../../lib/color"
import { STYLED_METHODS, defaultMethodToken } from "../../lib/methodColors"
import { updatePreferences, useResolvedTheme } from "../../lib/preferences"
import { PREFERENCES_TEXT } from "../../lib/preferencesText"
import { effectiveColors, withSurfaceColor, withoutMode, withoutSurface } from "../../lib/themes"

const TEXT = PREFERENCES_TEXT.methods
const FALLBACK_TEXT = "#808080"
const METHOD_ROLES = ["foreground", "background"]

function defaultTextColors(mode) {
  const styles = getComputedStyle(document.documentElement)
  const colorOf = (method) => tripletToHex(styles.getPropertyValue(`--${mode}-${defaultMethodToken(method)}`)) || FALLBACK_TEXT
  return Object.fromEntries(STYLED_METHODS.map((method) => [method, colorOf(method)]))
}

function MethodSample({ method, colors, page }) {
  return (
    <span aria-hidden="true" className="flex h-6 w-20 shrink-0 items-center rounded border border-border px-1.5" style={{ backgroundColor: page }}>
      <span
        className="rounded font-mono text-3xs font-semibold"
        style={{ color: colors.foreground, backgroundColor: colors.background, padding: colors.background ? "0 0.25rem" : 0 }}
      >
        {method}
      </span>
    </span>
  )
}

function MethodRow({ method, custom, defaultText, page, format, onColor, onReset }) {
  const colors = { foreground: custom?.foreground || defaultText, background: custom?.background || "" }
  const shown = { foreground: colors.foreground, background: colors.background || page }

  return (
    <tr className="border-b border-border last:border-b-0">
      <th scope="row" className={`${CELL} text-left font-normal`}>
        <MethodSample method={method} colors={colors} page={page} />
      </th>
      {METHOD_ROLES.map((role) => (
        <td key={role} className={CELL}>
          <ColorField
            label={TEXT.colorLabel(method, TEXT.roles[role])}
            hexLabel={TEXT.hexLabel(method, TEXT.roles[role])}
            value={shown[role]}
            isCustom={Boolean(custom?.[role])}
            onChange={(value) => onColor(method, role, value)}
          />
        </td>
      ))}
      <td className={`${CELL} whitespace-nowrap`}>
        <ContrastValue ratio={contrastRatio(shown.background, shown.foreground)} format={format} />
      </td>
      <td className="py-2 text-right">
        <IconButton label={TEXT.reset(method)} icon={RotateCcw} size="icon-xs" disabled={!custom} onClick={() => onReset(method)} />
      </td>
    </tr>
  )
}

export function MethodColors({ preferences }) {
  const resolvedMode = useResolvedTheme()
  const [mode, setMode] = useState(resolvedMode)
  const format = useRatioFormat(preferences.language)
  const { methodColors } = preferences
  const accentKey = `${preferences.accent}${preferences.accentColor}`
  const defaults = useMemo(() => defaultTextColors(mode), [mode, accentKey])
  const page = effectiveColors(preferences, mode, "window").background
  const hasCustom = Object.keys(methodColors[mode]).length > 0

  const setColor = (method, role, value) => updatePreferences({ methodColors: withSurfaceColor(methodColors, mode, method, role, value) })
  const resetMethod = (method) => updatePreferences({ methodColors: withoutSurface(methodColors, mode, method) })
  const resetMode = () => updatePreferences({ methodColors: withoutMode(methodColors, mode) })

  return (
    <PreferenceGroup
      title={TEXT.title}
      hint={TEXT.hint}
      action={<SegmentedControl label={TEXT.editing} options={MODE_OPTIONS} value={mode} onChange={setMode} />}
    >
      {mode !== resolvedMode && <p role="status" className="text-2xs text-muted-foreground">{PREFERENCES_TEXT.theme.previewHint[mode]}</p>}
      <div className="overflow-x-auto">
        <table aria-label={TEXT.title} className="w-full min-w-[30rem] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={HEADER}>{TEXT.columns.method}</th>
              <th scope="col" className={HEADER}>{TEXT.columns.foreground}</th>
              <th scope="col" className={HEADER}>{TEXT.columns.background}</th>
              <th scope="col" className={HEADER}>{TEXT.columns.contrast}</th>
              <th scope="col" className="pb-1.5"><span className="sr-only">{TEXT.columns.reset}</span></th>
            </tr>
          </thead>
          <tbody>
            {STYLED_METHODS.map((method) => (
              <MethodRow
                key={method}
                method={method}
                custom={methodColors[mode][method]}
                defaultText={defaults[method]}
                page={page}
                format={format}
                onColor={setColor}
                onReset={resetMethod}
              />
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
