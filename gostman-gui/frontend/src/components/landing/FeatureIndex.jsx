import { AnimatedSection } from "./AnimatedSection"
import { AI_AVAILABLE, AI_FEATURE } from "./content"
import { FEATURE_INDEX } from "./featureGroups"

const AI_ROW = { term: AI_FEATURE.title, text: AI_FEATURE.description }

const groupRows = (group, isLast) => (AI_AVAILABLE && isLast ? [...group.rows, AI_ROW] : group.rows)

function IndexGroup({ group, number, rows }) {
  return (
    <AnimatedSection className="border-t border-border/60 pt-5">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-hidden="true">
          {number}
        </span>
        <h3 className="text-lg font-medium tracking-tight">{group.title}</h3>
      </div>
      <dl className="mt-4">
        {rows.map((row) => (
          <div key={row.term} className="grid gap-1 border-t border-border/30 py-4 first:border-t-0 md:grid-cols-[13rem_1fr] md:gap-8">
            <dt className="text-sm font-medium">{row.term}</dt>
            <dd className="text-sm leading-relaxed text-muted-foreground">{row.text}</dd>
          </div>
        ))}
      </dl>
    </AnimatedSection>
  )
}

export function FeatureIndex() {
  return (
    <div className="flex flex-col gap-12">
      {FEATURE_INDEX.map((group, index) => (
        <IndexGroup
          key={group.id}
          group={group}
          number={String(index + 1).padStart(2, "0")}
          rows={groupRows(group, index === FEATURE_INDEX.length - 1)}
        />
      ))}
    </div>
  )
}
