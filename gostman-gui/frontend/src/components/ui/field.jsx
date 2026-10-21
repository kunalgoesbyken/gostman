export function Field({ label, children, grouped = false }) {
  const Root = grouped ? "div" : "label"
  return (
    <Root className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3">
      <span className="truncate text-xs text-muted-foreground" title={label}>{label}</span>
      {children}
    </Root>
  )
}
