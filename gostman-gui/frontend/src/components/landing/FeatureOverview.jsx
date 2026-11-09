import { ArrowRight } from "./icons"
import { SplitHeading } from "./SplitHeading"
import { FEATURE_GROUPS } from "./featureGroups"
import { revealStep } from "./revealStep"

function FeatureItem({ row }) {
  const Icon = row.icon
  return (
    <li>
      <a href={row.href} className="group flex gap-3 py-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground underline-offset-4 group-hover:underline">{row.term}</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">{row.short}</span>
        </span>
      </a>
    </li>
  )
}

export function FeatureOverview() {
  return (
    <div>
      <SplitHeading text="The rest of the toolbox" size="feature" />
      <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURE_GROUPS.map((group, index) => (
          <section key={group.id} aria-labelledby={`toolbox-${group.id}`} className="reveal-on-scroll border-t border-border/60 pt-4" style={revealStep(index)}>
            <h3 id={`toolbox-${group.id}`} className="landing-eyebrow">
              {group.title}
            </h3>
            <ul className="mt-2">
              {group.rows.map((row) => (
                <FeatureItem key={row.term} row={row} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      <a href="/features" className="mt-10 inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline">
        See all features
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  )
}
