export function IntegrationHint({ hint }) {
  if (!hint) return null
  const { tool, position } = hint
  return (
    <div key={tool.brand} aria-hidden="true" style={position} className="hint-pop pointer-events-none absolute z-10 rounded-xl border border-border bg-background p-3 text-left">
      <p className="text-sm font-semibold text-foreground">{tool.name}</p>
      <p className="mt-1 text-sm leading-snug text-muted-foreground">{tool.line}</p>
    </div>
  )
}
