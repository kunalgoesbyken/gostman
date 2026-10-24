import { BrandIcon } from "../ui/brandIcon"
import { Brand } from "./Brand"
import { FOOTER_COLUMNS } from "./footerLinks"

const FOOTER_LINK = "inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"

function FooterLink({ link }) {
  const target = link.external ? { target: "_blank", rel: "noopener noreferrer" } : {}
  return (
    <a href={link.href} className={FOOTER_LINK} {...target}>
      <BrandIcon brand={link.brand} className="h-4 w-4" />
      {link.label}
    </a>
  )
}

function FooterColumn({ column }) {
  return (
    <nav aria-label={column.title}>
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{column.title}</h2>
      <ul className="mt-4 space-y-3">
        {column.links.map((link) => (
          <li key={link.href}>
            <FooterLink link={link} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function SiteFooter() {
  return (
    <footer className="render-when-visible border-t border-border/40 bg-muted/10 px-6 py-16">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          <Brand tagline="API client for REST, GraphQL, gRPC and WebSocket" />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">Free and open source. No account, and your collections stay on your machine.</p>
        </div>
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          {FOOTER_COLUMNS.map((column) => (
            <FooterColumn key={column.title} column={column} />
          ))}
        </div>
      </div>
    </footer>
  )
}
