import { GLYPH_STATES, STATES } from "./comparisonData"
import { ComparisonGrid } from "./ComparisonGrid"
import { LandingBand } from "./LandingBand"
import { SplitHeading } from "./SplitHeading"
import { StatusGlyph } from "./StatusGlyph"
import { revealStep } from "./revealStep"

function Legend() {
  return (
    <ul className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground" aria-label="Legend">
      {GLYPH_STATES.map((state) => (
        <li key={state} className="flex items-center gap-2">
          <StatusGlyph state={state} />
          {STATES[state]}
        </li>
      ))}
    </ul>
  )
}

export function ComparisonSection() {
  return (
    <LandingBand id="compare" labelledBy="comparison-heading" isTinted>
      <div className="mb-12 max-w-2xl">
        <SplitHeading id="comparison-heading" text="How Gostman compares" />
        <p className="landing-lead reveal-on-scroll mt-5" style={revealStep(1)}>
          From their public pricing and docs, October 2026.
        </p>
      </div>

      <Legend />
      <ComparisonGrid />
    </LandingBand>
  )
}
