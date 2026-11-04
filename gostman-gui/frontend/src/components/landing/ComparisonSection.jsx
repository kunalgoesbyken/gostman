import { STATES } from "./comparisonData"
import { docPath } from "../../docs/manifest"
import { ComparisonGrid } from "./ComparisonGrid"
import { InlineLink } from "./InlineLink"
import { SectionLabel } from "./SectionLabel"
import { SplitHeading } from "./SplitHeading"
import { StatusGlyph } from "./StatusGlyph"

function Legend() {
  return (
    <ul className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground" aria-label="Legend">
      {Object.keys(STATES).map((state) => (
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
    <section id="compare" className="render-when-visible relative px-6 py-24" aria-labelledby="comparison-heading">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <SectionLabel number="003" label="Compare" />
          <SplitHeading
            id="comparison-heading"
            text="How Gostman compares"
            className="text-3xl font-semibold tracking-tight md:text-5xl [text-wrap:balance]"
          />
          <p className="mt-5 leading-relaxed text-muted-foreground">
            From their public pricing and docs, October 2026.
          </p>
        </div>

        <Legend />
        <ComparisonGrid />
        <p className="mt-6 text-sm text-muted-foreground">
          <InlineLink href={docPath("free-features")}>Prices and details</InlineLink>
        </p>
      </div>
    </section>
  )
}
