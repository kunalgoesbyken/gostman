import { BrandStrip } from "./ui/brandIcon"
import { ComparisonTable } from "./landing/ComparisonTable"
import { FaqList } from "./landing/FaqList"
import { LinkRow } from "./landing/LinkRow"
import { PageActions } from "./landing/PageActions"
import { PageShell } from "./landing/PageShell"
import { PointList } from "./landing/PointList"

const BODY_TEXT = "mt-4 leading-relaxed text-muted-foreground"
const SECTION_HEADING = "text-2xl font-semibold tracking-tight"

function Shot({ shot }) {
  return <img src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} loading="lazy" decoding="async" className="landing-frame mt-6 h-auto w-full" />
}

function Steps({ steps }) {
  return (
    <ol className="mt-5 space-y-4">
      {steps.map((step, index) => (
        <li key={step.title} className="flex items-start gap-4">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border font-mono text-xs text-muted-foreground">{index + 1}</span>
          <span className="leading-relaxed">
            <span className="font-medium text-foreground">{step.title}</span>{" "}
            <span className="text-muted-foreground">{step.text}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function Section({ block }) {
  return (
    <section className="mt-14">
      <h2 className={SECTION_HEADING}>{block.heading}</h2>
      {block.paragraphs?.map((text) => (
        <p key={text} className={BODY_TEXT}>{text}</p>
      ))}
      {block.steps ? <Steps steps={block.steps} /> : null}
      {block.items ? <PointList points={block.items} className="mt-5 space-y-3" /> : null}
      {block.shot ? <Shot shot={block.shot} /> : null}
      <BrandStrip brands={block.brands} className="mt-5" />
      {block.links ? <LinkRow links={block.links} className={BODY_TEXT} /> : null}
    </section>
  )
}

function Comparison({ comparison }) {
  return (
    <section className="mt-14">
      <h2 className={SECTION_HEADING}>{comparison.heading}</h2>
      <div className="mt-6 lg:-mx-24">
        <ComparisonTable products={comparison.products} rows={comparison.rows} caption={comparison.heading} />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Checked against each tool's own docs and pricing pages in {comparison.checked}. Plans change, so check them before you decide.</p>
    </section>
  )
}

function Questions({ faq }) {
  return (
    <section className="mt-14">
      <h2 className={`${SECTION_HEADING} mb-6`}>{faq.heading}</h2>
      <FaqList entries={faq.entries} />
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
        {page.comparison ? <Comparison comparison={page.comparison} /> : null}
        {page.faq ? <Questions faq={page.faq} /> : null}
        {page.links ? <LinkRow links={page.links} className={BODY_TEXT} /> : null}
      </main>
    </PageShell>
  )
}
