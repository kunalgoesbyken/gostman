import { AnimatedSection } from "./AnimatedSection"
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

export default function ComparisonSection() {
  return (
    <section className="relative px-6 py-24" aria-labelledby="comparison-heading">
      <div className="mx-auto max-w-6xl">
        <AnimatedSection className="mb-12 max-w-2xl">
          <SplitHeading
            id="comparison-heading"
            text="How Gostman compares"
            className="text-3xl font-semibold tracking-tight md:text-5xl [text-wrap:balance]"
          />
          <p className="mt-5 leading-relaxed text-muted-foreground">
            Short answers about Postman and Bruno. Plans change, so confirm on their pages before you decide.
          </p>
        </AnimatedSection>

        <Legend />
        <ComparisonTable />
      </div>
    </section>
  )
}
