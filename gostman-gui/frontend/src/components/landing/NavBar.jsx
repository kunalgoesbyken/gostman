export function NavBar({ children }) {
  return (
    <div className="max-w-5xl w-full backdrop-blur-xl bg-background/75 border border-border/40 rounded-2xl shadow-md">
      <div className="px-5 py-3 flex items-center justify-between">{children}</div>
    </div>
  )
}
