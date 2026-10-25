import { useLayoutEffect, useRef, useState } from "react"
import { ORIENTATION, moveFocus, tabStopOf } from "../../lib/rovingFocus"
import { cn } from "../../lib/utils"
import { Select } from "./select"

export const RADIO_KEYS = { selector: "[role=radio]", orientation: ORIENTATION.both, activate: true }

const GROUP_CLASS = "flex h-7 min-w-0 items-stretch divide-x divide-border rounded-md border border-border"
const OPTION_CLASS = "shrink-0 whitespace-nowrap px-2.5 text-xs font-medium"

const widthOf = (element) => element.getBoundingClientRect().width

const hasTextLabels = (options) => options.every((option) => typeof option.label === "string")

function useFitsInRow(isMeasured) {
  const rowRef = useRef(null)
  const measureRef = useRef(null)
  const [fit, setFit] = useState({ fits: true, fullWidth: undefined })

  useLayoutEffect(() => {
    if (!isMeasured) return undefined
    const measure = () => {
      const fullWidth = widthOf(measureRef.current)
      const fits = widthOf(rowRef.current) + 1 >= fullWidth
      setFit((current) => (current.fits === fits && current.fullWidth === fullWidth ? current : { fits, fullWidth }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(rowRef.current)
    observer.observe(measureRef.current)
    return () => observer.disconnect()
  }, [isMeasured])

  return { rowRef, measureRef, ...fit }
}

function Segments({ label, options, value, onChange }) {
  const tabStop = tabStopOf(options.map((option) => option.value), value)

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => moveFocus(event, RADIO_KEYS)}
      className={cn(GROUP_CLASS, "overflow-x-auto scrollbar-none")}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === tabStop ? 0 : -1}
          onClick={() => onChange(option.value)}
          className={cn(OPTION_CLASS, option.value === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function CompactChoice({ label, options, value, onChange }) {
  const choose = (event) => onChange(options.find((option) => String(option.value) === event.target.value).value)

  return (
    <div className="min-w-0 flex-1">
      <Select aria-label={label} value={value} onChange={choose}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
    </div>
  )
}

export function SegmentedControl({ label, options, value, onChange, className }) {
  const canCompact = hasTextLabels(options)
  const { rowRef, measureRef, fits, fullWidth } = useFitsInRow(canCompact)
  const Choice = fits ? Segments : CompactChoice

  return (
    <div ref={rowRef} style={{ flexBasis: fullWidth }} className={cn("relative flex min-w-0 shrink", className)}>
      <Choice label={label} options={options} value={value} onChange={onChange} />
      {canCompact && (
        <div aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden">
          <div ref={measureRef} className={cn(GROUP_CLASS, "w-max")}>
            {options.map((option) => <span key={option.value} className={cn(OPTION_CLASS, "flex items-center")}>{option.label}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}
