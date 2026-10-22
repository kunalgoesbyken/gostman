export function FeatureGroup({ group, number }) {
  return (
    <div className="border-t border-border/60 pt-5">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-hidden="true">
          {number}
        </span>
        <h3 className="text-lg font-medium tracking-tight">{group.title}</h3>
      </div>
      <dl className="mt-4">
        {group.rows.map((row) => (
          <div key={row.term} className="grid gap-1 border-t border-border/30 py-4 first:border-t-0 md:grid-cols-[13rem_1fr] md:gap-8">
            <dt className="text-sm font-medium">
              <a href={row.href} className="underline-offset-4 hover:text-primary hover:underline">{row.term}</a>
            </dt>
            <dd className="text-sm leading-relaxed text-muted-foreground">{row.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export const groupNumber = (index) => String(index + 1).padStart(2, "0")
