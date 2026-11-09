import { ISSUES_URL } from "../../../lib/siteLinks"
import { docPath } from "../../../docs/manifest"
import { ArrowLink } from "../ArrowLink"
import { LandingBand } from "../LandingBand"
import { PageActions } from "../PageActions"
import { PageHero } from "../PageHero"
import { PageShell } from "../PageShell"
import { FeatureItem } from "../FeatureItem"
import { SectionHeader } from "../SectionHeader"
import { featureHub } from "./featureHub"

function Highlight({ entry }) {
  return (
    <FeatureItem icon={entry.icon} title={entry.title} text={entry.blurb}>
      <ArrowLink href={entry.href} className="mt-auto pt-4">Learn more</ArrowLink>
    </FeatureItem>
  )
}

function FeatureLink({ entry }) {
  return (
    <li>
      <a href={entry.href} title={entry.blurb} className="flex items-baseline justify-between gap-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <span className="min-w-0">{entry.title}</span>
        {entry.availability ? <span className="max-w-[45%] shrink-0 text-right text-[0.6875rem] text-muted-foreground/70">{entry.availability}</span> : null}
      </a>
    </li>
  )
}

function FeatureGroup({ group }) {
  const heading = `group-${group.id}`
  return (
    <section aria-labelledby={heading} className="mb-12 break-inside-avoid">
      <h3 id={heading} className="flex items-baseline justify-between border-b border-border/50 pb-3 font-medium tracking-tight">
        {group.title}
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{group.entries.length}</span>
      </h3>
      <ul className="mt-3">
        {group.entries.map((entry) => (
          <FeatureLink key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  )
}

export function FeaturesPage({ page }) {
  const hub = featureHub()
  return (
    <PageShell>
      <main>
        <PageHero eyebrow="Features" heading={page.heading} intro={page.intro}>
          <PageActions className="mt-10 justify-center" />
        </PageHero>

        <LandingBand labelledBy="highlights-heading" isEager>
          <SectionHeader id="highlights-heading" title="Where Gostman stands out" isCentered />
          <ul className="mt-10 grid gap-x-10 sm:mt-14 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {hub.highlights.map((entry) => (
              <Highlight key={entry.id} entry={entry} />
            ))}
          </ul>
        </LandingBand>

        <LandingBand labelledBy="all-heading" isTinted isEager>
          <SectionHeader id="all-heading" title={`All ${hub.total} features`} lead="Each one links to its page in the documentation. Features without a label run in both the desktop and web apps." isCentered />
          <div className="mt-10 gap-x-10 sm:mt-14 sm:columns-2 lg:columns-3">
            {hub.groups.map((group) => (
              <FeatureGroup key={group.id} group={group} />
            ))}
          </div>
        </LandingBand>

        <LandingBand labelledBy="more-heading" isEager className="text-center">
          <SectionHeader id="more-heading" title="Missing something?" lead="Open an issue on GitHub and tell us what you need." isCentered />
          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3">
            <ArrowLink href={ISSUES_URL}>Suggest a feature</ArrowLink>
            <ArrowLink href={docPath("")}>Read the documentation</ArrowLink>
          </div>
        </LandingBand>
      </main>
    </PageShell>
  )
}
