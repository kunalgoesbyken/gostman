export function NavBar({ children }) {
  return (
    <nav aria-label="Gostman" className="fixed inset-x-0 top-0 z-50 border-b border-border/40 bg-background/90 px-4 backdrop-blur sm:px-6">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between">{children}</div>
    </nav>
  )
}
