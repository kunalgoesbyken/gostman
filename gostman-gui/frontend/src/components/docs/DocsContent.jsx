import { ComparisonTable } from "../landing/ComparisonTable"
import { ArrowLeft, ArrowRight, ChevronDown, List, Pen } from "../landing/icons"
import { DocsHome } from "./DocsHome"
import { DOCS_TEXT } from "../../lib/docsText"
import { docPath } from "../../docs/manifest"

const MOBILE_TOC_MIN = 2
const CRUMB = "transition-colors hover:text-foreground"
const NEIGHBOUR = "group flex flex-col gap-1 rounded-lg border border-border px-4 py-3 transition-colors hover:border-input hover:bg-muted/30"

function Breadcrumbs({ page }) {
  return (
    <nav aria-label={DOCS_TEXT.breadcrumb} className="mb-4 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <a href={docPath("")} className={CRUMB}>{DOCS_TEXT.docs}</a>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <a href={page.group.href} className={CRUMB}>{page.group.label}</a>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="text-foreground">{page.label}</li>
      </ol>
    </nav>
  )
}

function MobileToc({ toc }) {
  if (toc.length < MOBILE_TOC_MIN) return null
  return (
    <details className="group mt-6 rounded-lg border border-border xl:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <List className="h-4 w-4 text-muted-foreground" />
        {DOCS_TEXT.onThisPage}
        <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <nav aria-label={DOCS_TEXT.onThisPage} className="border-t border-border px-4 py-3">
        <ul className="space-y-1.5 text-sm">
          {toc.map((entry) => (
            <li key={entry.id} className={entry.depth > 2 ? "pl-4" : undefined}>
              <a href={`#${entry.id}`} className="text-muted-foreground transition-colors hover:text-foreground">{entry.text}</a>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  )
}

function Neighbour({ link, direction }) {
  const isNext = direction === "next"
  const Arrow = isNext ? ArrowRight : ArrowLeft
  return (
    <a href={link.href} rel={direction} className={`${NEIGHBOUR} ${isNext ? "sm:col-start-2 sm:items-end sm:text-right" : ""}`}>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {isNext ? null : <Arrow className="h-3.5 w-3.5" />}
        {isNext ? DOCS_TEXT.next : DOCS_TEXT.previous}
        {isNext ? <Arrow className="h-3.5 w-3.5" /> : null}
      </span>
      <span className="font-medium text-foreground">{link.label}</span>
    </a>
  )
}

function PageFooter({ page }) {
  return (
    <footer className="mt-16 border-t border-border pt-6">
      <a href={page.editUrl} rel="noopener" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <Pen className="h-4 w-4" />
        {DOCS_TEXT.editPage}
      </a>
      <nav aria-label={DOCS_TEXT.pager} className="mt-6 grid gap-3 sm:grid-cols-2">
        {page.previous ? <Neighbour link={page.previous} direction="prev" /> : null}
        {page.next ? <Neighbour link={page.next} direction="next" /> : null}
      </nav>
    </footer>
  )
}

export function DocsContent({ page, directory }) {
  return (
    <>
      {page.home ? null : <Breadcrumbs page={page} />}
      <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground [text-wrap:balance] sm:text-4xl">{page.title}</h1>
      {page.lead ? <div className="docs-lead mt-4" dangerouslySetInnerHTML={{ __html: page.lead }} /> : null}
      <MobileToc toc={page.toc} />
      <article id="docs-article" className="docs-prose mt-5" dangerouslySetInnerHTML={{ __html: page.html }} />
      {page.comparison ? <div className="mt-8"><ComparisonTable /></div> : null}
      {page.home ? <DocsHome directory={directory} /> : null}
      <PageFooter page={page} />
    </>
  )
}
