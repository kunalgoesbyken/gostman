import { cn } from "../../lib/utils"

export function SegmentedControl({ label, options, value, onChange, className }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex h-7 min-w-0 shrink-0 items-stretch divide-x divide-border overflow-x-auto rounded-md border border-border scrollbar-none", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
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
