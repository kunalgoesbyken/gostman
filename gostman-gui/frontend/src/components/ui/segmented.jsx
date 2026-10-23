import { ORIENTATION, moveFocus, tabStopOf } from "../../lib/rovingFocus"
import { cn } from "../../lib/utils"

export const RADIO_KEYS = { selector: "[role=radio]", orientation: ORIENTATION.both, activate: true }

export function SegmentedControl({ label, options, value, onChange, className }) {
  const tabStop = tabStopOf(options.map((option) => option.value), value)

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => moveFocus(event, RADIO_KEYS)}
      className={cn("flex h-7 min-w-0 items-stretch divide-x divide-border overflow-x-auto rounded-md border border-border scrollbar-none", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === tabStop ? 0 : -1}
          onClick={() => onChange(option.value)}
          className={cn(
            "shrink-0 whitespace-nowrap px-2.5 text-xs font-medium",
            option.value === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
