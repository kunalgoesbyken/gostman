export function Field({ label, children }) {
  return (
    <label className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
