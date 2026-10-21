import { ExternalLink } from "lucide-react"
import { BRUNO_PLANS, BRUNO_PRICING_URL, COMPARISON_DATE, COMPARISON_ROWS, COMPARISON_SOURCES } from "./content"

const SOURCE_NUMBER = Object.fromEntries(COMPARISON_SOURCES.map((source, index) => [source.id, index + 1]))

function planList() {
  return BRUNO_PLANS.map((plan) => `${plan.name} (${plan.price})`).join(", ")
}

function Citation({ id }) {
  const number = SOURCE_NUMBER[id]
  return (
    <a
      href={`#comparison-source-${id}`}
      aria-label={`Source ${number}`}
      className="ml-1 inline-flex min-h-6 items-center align-super text-[0.7rem] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      [{number}]
    </a>
  )
}

function ComparisonRow({ row }) {
  return (
    <li className="grid gap-3 border-b border-border/40 py-5 sm:grid-cols-[1fr_1.4fr_1fr] sm:gap-8">
      <h3 className="text-sm font-medium">{row.feature}</h3>
      <p className="text-sm leading-relaxed text-foreground/90">
        <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground sm:hidden">Gostman includes</span>
        {row.gostman}
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        <span className="mb-1 block text-xs uppercase tracking-wide sm:hidden">Bruno documentation</span>
        {row.bruno}
        <Citation id={row.source} />
      </p>
    </li>
  )
}

function SourceList() {
  return (
    <ol className="mt-8 space-y-1.5 text-xs text-muted-foreground">
      {COMPARISON_SOURCES.map((source, index) => (
        <li key={source.id} id={`comparison-source-${source.id}`} className="flex scroll-mt-28 gap-2">
          <span aria-hidden="true">[{index + 1}]</span>
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
    <section className="relative px-6 py-20" aria-labelledby="comparison-heading">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 max-w-2xl">
          <h2 id="comparison-heading" className="text-3xl font-semibold tracking-tight md:text-4xl [text-wrap:balance]">
            One free app. No tiers.
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Gostman is open source and every feature is in the download. Bruno also has a free open source plan; its pricing page lists {planList()}.
            <Citation id="pricing" /> Where Bruno documents a feature under a paid plan, Gostman includes it.
          </p>
        </div>

        <div className="hidden gap-8 border-b border-border/60 pb-3 text-xs uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[1fr_1.4fr_1fr]">
          <span>Feature</span>
          <span>Gostman includes</span>
          <span>Bruno documentation</span>
        </div>
        <ul>
          {COMPARISON_ROWS.map((row) => (
            <ComparisonRow key={row.feature} row={row} />
          ))}
        </ul>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Checked against Bruno's public pages on {COMPARISON_DATE}. Plans change, so confirm on{" "}
          <a href={BRUNO_PRICING_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
            Bruno's pricing page
          </a>
          .
        </p>
        <SourceList />
      </div>
    </section>
  )
}
