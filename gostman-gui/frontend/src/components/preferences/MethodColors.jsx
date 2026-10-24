import { ColorModeTable } from "./ColorModeTable"
import { tripletToHex } from "../../lib/color"
import { STYLED_METHODS, defaultMethodToken } from "../../lib/methodColors"
import { PREFERENCES_TEXT } from "../../lib/preferencesText"
import { effectiveColors } from "../../lib/themes"
import { cn } from "../../lib/utils"

const TEXT = PREFERENCES_TEXT.methods
const METHOD_ROLES = ["foreground", "background"]

function MethodSample({ method, foreground, background, page }) {
  return (
    <span aria-hidden="true" className="flex h-6 w-20 shrink-0 items-center rounded border border-border px-1.5" style={{ backgroundColor: page }}>
      <span className={cn("rounded font-mono text-3xs font-semibold", background && "px-1")} style={{ color: foreground, backgroundColor: background }}>
        {method}
      </span>
    </span>
  )
}

const defaultTextColor = (styles, mode, method) => tripletToHex(styles.getPropertyValue(`--${mode}-${defaultMethodToken(method)}`))

function methodRows(preferences, mode) {
  const styles = getComputedStyle(document.documentElement)
  const windowColors = effectiveColors(preferences, mode, "window")
  const page = windowColors.background
  return STYLED_METHODS.map((method) => {
    const custom = preferences.methodColors[mode][method]
    const foreground = custom?.foreground || defaultTextColor(styles, mode, method) || windowColors.foreground
    const background = custom?.background
    return {
      id: method,
      name: method,
      colors: { foreground, background: background || page },
      sample: <MethodSample method={method} foreground={foreground} background={background} page={page} />,
    }
  })
}

export function MethodColors({ preferences }) {
  return (
    <ColorModeTable
      title={TEXT.title}
      hint={TEXT.hint}
      nameColumn={TEXT.method}
      colorKey="methodColors"
      roles={METHOD_ROLES}
      preferences={preferences}
      rowsFor={(mode) => methodRows(preferences, mode)}
      resetModeLabel={TEXT.resetMode}
    />
  )
}
