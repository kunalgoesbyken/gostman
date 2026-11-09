import { SiteFooter } from "./SiteFooter"
import { SiteHeader } from "./SiteHeader"

export function PageShell({ children }) {
  return (
    <div className="dark min-h-screen bg-background text-foreground overflow-x-clip">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  )
}
