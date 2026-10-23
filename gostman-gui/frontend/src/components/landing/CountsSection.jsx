import { SNIPPET_LANGUAGES } from "../../lib/codeGenerator"
import { AUTH_METHODS } from "../../lib/authTypes"
import { OTHER_TOOL_FORMATS } from "../../lib/importText"
import { docPath } from "../../docs/manifest"
import { PROTOCOLS, formatList } from "./content"

const labelsOf = (items) => items.map((item) => item.label)

const COUNTS = [
  { label: "Protocols", items: PROTOCOLS },
  { label: "Auth methods", items: labelsOf(AUTH_METHODS) },
  { label: "Languages for code snippets", items: labelsOf(SNIPPET_LANGUAGES) },
  { label: "Formats to import", items: labelsOf(OTHER_TOOL_FORMATS) },
]

function Count({ count }) {
  return (
    <div className="flex flex-col gap-2 bg-background p-6 md:p-8">
      <dt className="order-2 text-sm font-medium">{count.label}</dt>
      <dd className="order-1 text-5xl font-semibold tracking-tight tabular-nums md:text-6xl">{count.items.length}</dd>
      <dd className="order-3 text-xs leading-relaxed text-muted-foreground">{formatList(count.items)}</dd>
    </div>
  )
}

export function CountsSection() {
  return (
    <section className="px-6 py-16" aria-labelledby="counts-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="counts-heading" className="sr-only">Gostman by the numbers</h2>
        <dl className="reveal-on-scroll grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
          {COUNTS.map((count) => (
            <Count key={count.label} count={count} />
          ))}
        </dl>
        <p className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <a href={docPath("import-export-and-specs")} className="underline-offset-4 hover:text-foreground hover:underline">
            Bring your collections from
          </a>
          {labelsOf(OTHER_TOOL_FORMATS).map((name) => (
            <span key={name} className="rounded-full border border-border/60 px-3 py-1 text-foreground/90">
              {name}
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}
