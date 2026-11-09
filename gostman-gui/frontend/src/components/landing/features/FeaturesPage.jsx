import { ISSUES_URL } from "../../../lib/siteLinks"
import { docPath } from "../../../docs/manifest"
import { LandingBand } from "../LandingBand"
import { LinkRow } from "../LinkRow"
import { PageActions } from "../PageActions"
import { PageShell } from "../PageShell"
import { SplitHeading } from "../SplitHeading"
import { revealStep } from "../revealStep"
import { featureHub } from "./featureHub"

const groupAnchor = (group) => `group-${group.id}`

const BADGE = "landing-eyebrow shrink-0 rounded border border-border/60 px-1.5 py-0.5 text-[0.6875rem]"

function GroupNav({ groups }) {
  return (
    <nav aria-label="Feature groups" className="lg:sticky lg:top-24 lg:self-start">
      <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-0">
        {groups.map((group) => (
          <li key={group.id}>
            <a
              href={`#${groupAnchor(group)}`}
              className="flex items-baseline justify-between gap-4 rounded-md border border-border/60 px-3 py-1.5 text-sm transition-colors hover:bg-muted/50 lg:rounded-none lg:border-0 lg:border-b lg:border-border/40 lg:px-0 lg:py-2.5 lg:hover:bg-transparent lg:hover:text-primary"
            >
              {group.title}
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{group.entries.length}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function FeatureEntry({ entry }) {
  const Icon = entry.icon
  return (
    <li className="flex gap-3 border-t border-border/40 py-4">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
      <div className="min-w-0">
        <h3 className="text-sm font-medium">
          <a href={entry.href} className="underline-offset-4 hover:text-primary hover:underline">
            {entry.title}
          </a>
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{entry.blurb}</p>
        {entry.availability ? (
          <p className="mt-3">
            <span className={BADGE}>{entry.availability}</span>
          </p>
        ) : null}
      </div>
    </li>
  )
}

function FeatureGroup({ group, number }) {
  const heading = `${groupAnchor(group)}-heading`
  return (
    <section id={groupAnchor(group)} aria-labelledby={heading}>
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-hidden="true">
          {String(number).padStart(2, "0")}
        </span>
        <h2 id={heading} className="text-2xl font-semibold tracking-tight">{group.title}</h2>
      </div>
      <ul className="mt-6 grid gap-x-10 sm:grid-cols-2">
        {group.entries.map((entry) => (
          <FeatureEntry key={entry.id} entry={entry} />
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
        <section className="mx-auto max-w-3xl px-6 pb-16 pt-36">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] [text-wrap:balance]">{page.heading}</h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{page.intro}</p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {hub.total} features in {hub.groups.length} groups. {hub.inBrowser} of them run in the web app; the rest need the desktop app or the command line. A feature without a badge runs in both the desktop and web apps.
          </p>
          <PageActions className="mt-8" />
        </section>

        <LandingBand labelledBy="features-heading" isEager className="grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
          <h2 id="features-heading" className="sr-only">Features by group</h2>
          <GroupNav groups={hub.groups} />
          <div className="flex min-w-0 flex-col gap-16">
            {hub.groups.map((group, index) => (
              <FeatureGroup key={group.id} group={group} number={index + 1} />
            ))}
          </div>
        </LandingBand>

        <LandingBand labelledBy="more-heading" isTinted isEager className="text-center">
          <SplitHeading id="more-heading" text="Missing something?" />
          <p className="landing-lead reveal-on-scroll mx-auto mt-5 max-w-lg" style={revealStep(1)}>
            Every feature above links to its page in the documentation. If something you need is not here, open an issue on GitHub.
          </p>
          <LinkRow
            links={[
              { label: "Read the documentation", href: docPath("") },
              { label: "Suggest a feature", href: ISSUES_URL, brand: "github" },
            ]}
            className="mt-8 justify-center"
          />
        </LandingBand>
      </main>
    </PageShell>
  )
}
