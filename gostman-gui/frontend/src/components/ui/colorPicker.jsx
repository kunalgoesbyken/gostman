import { useEffect, useRef } from "react"
import { Plus } from "lucide-react"
import { RADIO_KEYS } from "./segmented"
import { COLOR_TEXT } from "../../lib/environmentText"
import { isHexColor } from "../../lib/color"
import { OPENS_PICKER, moveFocus, tabStopOf } from "../../lib/rovingFocus"
import { SWATCH_NAMES, colorHex } from "../../lib/swatches"
import { cn } from "../../lib/utils"

const CUSTOM = "custom"
const OPTIONS = [...SWATCH_NAMES, CUSTOM]
const STARTING_CUSTOM_COLOR = "#14b8a6"
const SELECTED_RING = "ring-1 ring-foreground ring-offset-1 ring-offset-background"
const SWATCH_SIZES = {
  sm: { button: "h-5 w-5", dot: "h-3.5 w-3.5" },
  md: { button: "h-6 w-6", dot: "h-4 w-4" },
}

export function ColorDot({ color, className }) {
  const hex = colorHex(color)
  return (
    <span
      aria-hidden="true"
      style={hex ? { backgroundColor: hex } : undefined}
      className={cn("h-2 w-2 shrink-0 rounded-full", !hex && "border border-border", className)}
    />
  )
}

function openPicker(input) {
  try {
    input.showPicker()
  } catch {
    input.click()
  }
}

export function CustomColorSwatch({ value, isSelected, isTabStop, size = "sm", onChange }) {
  const inputRef = useRef(null)
  const sizes = SWATCH_SIZES[size]
  const onChangeRef = useRef(onChange)
  const title = isSelected ? COLOR_TEXT.customValue(value) : COLOR_TEXT.custom

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const input = inputRef.current
    const commit = () => onChangeRef.current(input.value.toLowerCase())
    input.addEventListener("change", commit)
    return () => input.removeEventListener("change", commit)
  }, [])

  const choose = () => {
    inputRef.current.value = isHexColor(value) ? value : STARTING_CUSTOM_COLOR
    openPicker(inputRef.current)
  }

  return (
    <span className="relative flex">
      <button
        type="button"
        role="radio"
        aria-checked={isSelected}
        aria-label={title}
        title={title}
        tabIndex={isTabStop ? 0 : -1}
        onClick={choose}
        {...{ [OPENS_PICKER]: "" }}
        className={cn("flex items-center justify-center rounded-full", sizes.button, isSelected && SELECTED_RING)}
      >
        {isSelected ? (
          <span aria-hidden="true" className={cn("rounded-full", sizes.dot)} style={{ backgroundColor: value }} />
        ) : (
          <span aria-hidden="true" className={cn("flex items-center justify-center rounded-full border border-dashed border-muted-foreground text-muted-foreground", sizes.dot)}>
            <Plus className="h-2.5 w-2.5" />
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="color"
        tabIndex={-1}
        aria-hidden="true"
        defaultValue={STARTING_CUSTOM_COLOR}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </span>
  )
}

const colorTitle = (color, isAutomatic) => (isAutomatic ? COLOR_TEXT.automatic(COLOR_TEXT.names[color]) : COLOR_TEXT.names[color])

const optionOf = (value) => (isHexColor(value) ? CUSTOM : value)

export function ColorPicker({ label, value, automatic, onChange }) {
  const selected = optionOf(value)
  const tabStop = tabStopOf(OPTIONS, selected || automatic)

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={(event) => moveFocus(event, RADIO_KEYS)} className="flex flex-wrap items-center gap-1.5">
      {SWATCH_NAMES.map((color) => {
        const isAutomatic = !value && color === automatic
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected === color}
            aria-label={colorTitle(color, isAutomatic)}
            tabIndex={color === tabStop ? 0 : -1}
            title={colorTitle(color, isAutomatic)}
            onClick={() => onChange(selected === color ? "" : color)}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full",
              selected === color && SELECTED_RING,
              isAutomatic && "outline-dashed outline-1 outline-offset-1 outline-muted-foreground"
            )}
          >
            <ColorDot color={color} className="h-3.5 w-3.5" />
          </button>
        )
      })}
      <CustomColorSwatch value={value} isSelected={selected === CUSTOM} isTabStop={tabStop === CUSTOM} onChange={onChange} />
    </div>
  )
}
