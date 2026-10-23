import { STATES } from "./comparisonData"
import { ComparisonTable } from "./ComparisonTable"
import { SplitHeading } from "./SplitHeading"
import { StatusGlyph } from "./StatusGlyph"

function Legend() {
  return (
    <ul className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground" aria-label="Legend">
      {["included", "partial"].map((state) => (
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
    <section id="compare" className="render-when-visible relative border-y border-border/60 bg-card/40 px-6 py-24" aria-labelledby="comparison-heading">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <SplitHeading
            id="comparison-heading"
            text="How Gostman compares"
            className="text-3xl font-semibold tracking-tight md:text-5xl [text-wrap:balance]"
          />
          <p className="mt-5 leading-relaxed text-muted-foreground">
            Short answers about Postman and Bruno. Plans change, so confirm on their pages before you decide.
          </p>
        </div>

        <Legend />
        <ComparisonTable />
      </div>
    </section>
  )
}
