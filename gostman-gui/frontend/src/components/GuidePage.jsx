import { BrandStrip } from "./ui/brandIcon"
import { LinkRow } from "./landing/LinkRow"
import { PageActions } from "./landing/PageActions"
import { PageShell } from "./landing/PageShell"
import { PointList } from "./landing/PointList"

const BODY_TEXT = "mt-4 leading-relaxed text-muted-foreground"

function Section({ block }) {
  return (
    <section className="mt-14">
      <h2 className="text-2xl font-semibold tracking-tight">{block.heading}</h2>
      {block.paragraphs?.map((text) => (
        <p key={text} className={BODY_TEXT}>{text}</p>
      ))}
      {block.items ? <PointList points={block.items} className="mt-5 space-y-3" /> : null}
      <BrandStrip brands={block.brands} className="mt-5" />
      {block.links ? <LinkRow links={block.links} className={BODY_TEXT} /> : null}
    </section>
  )
}

export function GuidePage({ page }) {
  return (
    <PageShell>
      <main className="relative mx-auto max-w-3xl px-6 pb-20 pt-28 sm:pt-36">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] [text-wrap:balance]">{page.heading}</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{page.intro}</p>
        <BrandStrip brands={page.brands} className="mt-5" />
        {page.code ? (
          <pre className="mt-8 overflow-x-auto rounded-lg border border-border/60 bg-card p-4 font-mono text-sm">
            <code>{page.code}</code>
          </pre>
        ) : null}
        <PageActions className="mt-8" />
        {page.sections.map((block) => (
          <Section key={block.heading} block={block} />
        ))}
        {page.links ? <LinkRow links={page.links} className={BODY_TEXT} /> : null}
      </main>
    </PageShell>
  )
}
