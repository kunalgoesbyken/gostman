import { docPath } from "../../docs/manifest"
import { STATES } from "./comparisonData"
import { ComparisonTable } from "./ComparisonTable"
import { SectionLabel } from "./SectionLabel"
import { SplitHeading } from "./SplitHeading"
import { StatusGlyph } from "./StatusGlyph"
import { SITE_LANGUAGE } from "./content"

const MIGRATION_GUIDES = [
  { slug: "coming-from-postman", label: "Coming from Postman" },
  { slug: "coming-from-bruno", label: "Coming from Bruno" },
  { slug: "coming-from-insomnia", label: "Coming from Insomnia" },
]

const GUIDE_LINK = "text-foreground underline underline-offset-4 hover:text-primary"

const guideLabelled = (label) => MIGRATION_GUIDES.find((guide) => guide.label === label)

function MigrationLinks() {
  const parts = new Intl.ListFormat(SITE_LANGUAGE, { type: "disjunction" }).formatToParts(MIGRATION_GUIDES.map((guide) => guide.label))
  return parts.map((part, index) => {
    if (part.type !== "element") return part.value
    return (
      <a key={index} href={docPath(guideLabelled(part.value).slug)} className={GUIDE_LINK}>
        {part.value}
      </a>
    )
  })
}

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
            From their public pricing and docs, October 2026. Moving from another client? Read <MigrationLinks />.
          </p>
        </div>

        <Legend />
        <ComparisonTable />
      </div>
    </section>
  )
}
