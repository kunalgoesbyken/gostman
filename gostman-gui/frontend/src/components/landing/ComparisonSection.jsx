import { ExternalLink } from "lucide-react"
import { AnimatedSection } from "./AnimatedSection"
import { COMPARISON_DATE, COMPARISON_SOURCES, STATES } from "./comparisonData"
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

function SourceList() {
  return (
    <ol className="mt-8 space-y-1.5 text-xs text-muted-foreground">
      {COMPARISON_SOURCES.map((source, index) => (
        <li key={source.id} id={`comparison-source-${source.id}`} className="flex scroll-mt-40 gap-2">
          <span aria-hidden="true" className="w-6 tabular-nums">
            [{index + 1}]
          </span>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-6 items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
          >
            {source.label}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ol>
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
            Short, sourced answers about Postman and Bruno, taken from their public pages. Plans change, so confirm on their pages before you decide.
          </p>
        </AnimatedSection>

        <Legend />
        <ComparisonTable />
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">Checked on {COMPARISON_DATE}.</p>
        <SourceList />
      </div>
    </section>
  )
}
