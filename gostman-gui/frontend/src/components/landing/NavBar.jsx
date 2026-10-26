export function NavBar({ banner, children }) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur">
      {banner}
      <nav aria-label="Gostman" className="px-6">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between">{children}</div>
      </nav>
    </div>
  )
}
