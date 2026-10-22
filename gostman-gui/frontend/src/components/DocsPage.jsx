import { cn } from "../lib/utils"
import { DocsNav } from "./DocsNav"
import { ComparisonTable } from "./landing/ComparisonTable"
import { FeatureIndex } from "./landing/FeatureIndex"
import { SiteFooter } from "./landing/SiteFooter"
import { SiteHeader } from "./landing/SiteHeader"
import { docPath } from "../docs/manifest"

const PROSE = [
  "leading-relaxed text-muted-foreground",
  "[&_h2]:mt-14 [&_h2]:scroll-mt-28 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
  "[&_h3]:mt-8 [&_h3]:scroll-mt-28 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground",
  "[&_p]:mt-4",
  "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6",
  "[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6",
  "[&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline",
  "[&_strong]:text-foreground",
  "[&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-foreground",
  "[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5",
  "[&_pre]:mt-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-card [&_pre]:p-4 [&_pre]:text-sm",
  "[&_table]:mt-5 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:text-sm",
  "[&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-foreground",
  "[&_td]:border-b [&_td]:border-border/40 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
  "[&_img]:mt-6 [&_img]:h-auto [&_img]:w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-border/60",
  "[&_blockquote]:mt-4 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4",
].join(" ")

const NEIGHBOUR = "rounded-lg border border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/40"

function OnThisPage({ toc }) {
  if (toc.length < 3) return null
  return (
    <nav aria-label="On this page" className="mt-8 rounded-lg border border-border/60 bg-card/40 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">On this page</p>
      <ul className="mt-3 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
        {toc.map((entry) => (
          <li key={entry.id}>
            <a href={`#${entry.id}`} className="text-muted-foreground transition-colors hover:text-foreground">
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Neighbours({ previous, next }) {
  return (
    <nav aria-label="More documentation" className="mt-16 grid gap-3 sm:grid-cols-2">
      {previous ? (
        <a href={previous.href} className={NEIGHBOUR}>
          <span className="block text-xs text-muted-foreground">Previous</span>
          {previous.title}
        </a>
      ) : (
        <span />
      )}
      {next ? (
        <a href={next.href} className={cn(NEIGHBOUR, "sm:text-right")}>
          <span className="block text-xs text-muted-foreground">Next</span>
          {next.title}
        </a>
      ) : null}
    </nav>
  )
}

function Home() {
  return (
    <section className="mt-16">
      <h2 className="text-2xl font-semibold tracking-tight">Everything Gostman does</h2>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        Each feature links to the page that explains it.
      </p>
      <div className="mt-8">
        <FeatureIndex />
      </div>
    </section>
  )
}

export function DocsPage({ page, nav }) {
  const isHome = page.slug === ""

  return (
    <div className="dark min-h-screen bg-background text-foreground overflow-x-clip">
      <SiteHeader />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-6 pt-32 pb-20 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-14">
        <aside>
          <DocsNav nav={nav} currentHref={docPath(page.slug)} />
        </aside>
        <main className="min-w-0 max-w-3xl">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight [text-wrap:balance] md:text-5xl">{page.title}</h1>
          <OnThisPage toc={page.toc} />
          <article className={cn("mt-8", PROSE)} dangerouslySetInnerHTML={{ __html: page.html }} />
          {page.comparison ? <div className="mt-8"><ComparisonTable /></div> : null}
          {isHome ? <Home /> : null}
          <Neighbours previous={page.previous} next={page.next} />
        </main>
      </div>

      <SiteFooter />
    </div>
  )
}
