import { STATES } from "./comparisonData"

const SHAPES = {
  included: (
    <>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M4.8 8.2l2.2 2.2 4.2-4.6" fill="none" stroke="hsl(var(--background))" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  partial: (
    <>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 1.8a6.2 6.2 0 0 1 0 12.4z" fill="currentColor" />
    </>
  ),
  excluded: (
    <>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.4 8h5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
}

const TONES = {
  included: "text-success",
  partial: "text-amber-400",
  excluded: "text-muted-foreground",
}

export function StatusGlyph({ state }) {
  return (
    <>
      <svg viewBox="0 0 16 16" className={`mt-0.5 h-4 w-4 shrink-0 ${TONES[state]}`} aria-hidden="true">
        {SHAPES[state]}
      </svg>
      <span className="sr-only">{STATES[state]}: </span>
    </>
  )
}
