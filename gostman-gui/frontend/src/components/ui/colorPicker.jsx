import { RADIO_KEYS } from "./segmented"
import { COLOR_TEXT, ENVIRONMENT_COLORS } from "../../lib/environmentText"
import { moveFocus, tabStopOf } from "../../lib/rovingFocus"
import { cn } from "../../lib/utils"

const COLOR_NAMES = Object.keys(ENVIRONMENT_COLORS)

export function ColorDot({ color, className }) {
  return <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", ENVIRONMENT_COLORS[color] || "border border-border", className)} />
}

const colorTitle = (color, isAutomatic) => (isAutomatic ? COLOR_TEXT.automatic(COLOR_TEXT.names[color]) : COLOR_TEXT.names[color])

export function ColorPicker({ label, value, automatic, onChange }) {
  const tabStop = tabStopOf(COLOR_NAMES, value || automatic)

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={(event) => moveFocus(event, RADIO_KEYS)} className="flex items-center gap-1.5">
      {COLOR_NAMES.map((color) => {
        const isAutomatic = !value && color === automatic
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={value === color}
            aria-label={colorTitle(color, isAutomatic)}
            tabIndex={color === tabStop ? 0 : -1}
            title={colorTitle(color, isAutomatic)}
            onClick={() => onChange(value === color ? "" : color)}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full",
              value === color && "ring-1 ring-foreground ring-offset-1 ring-offset-background",
              isAutomatic && "outline-dashed outline-1 outline-offset-1 outline-muted-foreground"
            )}
          >
            <ColorDot color={color} className="h-3.5 w-3.5" />
          </button>
        )
      })}
    </div>
  )
}
