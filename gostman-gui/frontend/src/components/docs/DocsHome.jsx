import { ArrowRight } from "../landing/icons"
import { FeatureIndex } from "../landing/FeatureIndex"
import { DOCS_TEXT } from "../../lib/docsText"
import { REPOSITORY_URL } from "../../lib/siteLinks"

const EXAMPLES_URL = `${REPOSITORY_URL}/blob/main/examples/README.md`
const HEADING = "text-xl font-semibold tracking-tight text-foreground"
const LINK = "text-sm text-muted-foreground transition-colors hover:text-foreground"

function StartCard({ item }) {
  return (
    <a href={item.href} className="group flex flex-col rounded-lg border border-border p-4 transition-colors hover:border-input hover:bg-muted/30">
      <span className="flex items-center justify-between gap-2 font-medium text-foreground">
        {item.label}
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
      </span>
      <span className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.description}</span>
    </a>
  )
}

function AreaLinks({ group, extra }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-foreground">{group.title}</h3>
      <ul className="mt-3 space-y-2">
        {group.items.map((item) => (
          <li key={item.href}>
            <a href={item.href} className={LINK}>{item.label}</a>
          </li>
        ))}
        {extra}
      </ul>
    </div>
  )
}

const examplesLink = (
  <li>
    <a href={EXAMPLES_URL} rel="noopener" className={LINK}>{DOCS_TEXT.homePage.examples}</a>
  </li>
)

export function DocsHome({ directory }) {
  const [start, ...areas] = directory
  const lastArea = areas.at(-1)

  return (
    <>
      <section aria-labelledby="docs-home-start" className="mt-12">
        <h2 id="docs-home-start" className={HEADING}>{DOCS_TEXT.homePage.start}</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {start.items.slice(1).map((item) => (
            <StartCard key={item.href} item={item} />
          ))}
        </div>
      </section>
      <section aria-labelledby="docs-home-areas" className="mt-14">
        <h2 id="docs-home-areas" className={HEADING}>{DOCS_TEXT.homePage.browse}</h2>
        <div className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((group) => (
            <AreaLinks key={group.title} group={group} extra={group === lastArea ? examplesLink : null} />
          ))}
        </div>
      </section>
      <section aria-labelledby="docs-home-features" className="mt-16">
        <h2 id="docs-home-features" className={HEADING}>{DOCS_TEXT.homePage.everything}</h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">{DOCS_TEXT.homePage.everythingLead}</p>
        <div className="mt-8">
          <FeatureIndex />
        </div>
      </section>
    </>
  )
}
