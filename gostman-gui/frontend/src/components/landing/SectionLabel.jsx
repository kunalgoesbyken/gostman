export function SectionLabel({ number, label }) {
  return (
    <p className="mb-5 font-mono text-xs uppercase tracking-[0.2em]">
      <span className="text-muted-foreground/60">{number}</span>
      <span className="ms-3 text-foreground/80">{label}</span>
    </p>
  )
}
