import { Heart } from "lucide-react"
import { BrandIcon } from "../ui/brandIcon"
import { WEB_APP_URL } from "../../lib/constants"
import { SPONSOR_URL } from "../../lib/siteLinks"
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

const AI_QUESTION = encodeURIComponent(`What is Gostman (${WEB_APP_URL})? Summarise what it does and how it compares with Postman, Insomnia and Bruno.`)

const ASSISTANTS = [
  { name: "ChatGPT", brand: "openai", href: `https://chatgpt.com/?q=${AI_QUESTION}` },
  { name: "Claude", brand: "claude", href: `https://claude.ai/new?q=${AI_QUESTION}` },
]

function AskAssistants() {
  return (
    <div className="flex items-center gap-3">
      <span>Ask an AI about Gostman</span>
      {ASSISTANTS.map((assistant) => (
        <a
          key={assistant.name}
          href={assistant.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ask ${assistant.name} about Gostman`}
          title={assistant.name}
          className="rounded-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <BrandIcon brand={assistant.brand} className="h-4 w-4" />
        </a>
      ))}
    </div>
  )
}

function FooterColumn({ column }) {
  return (
    <nav aria-label={column.title}>
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{column.title}</h2>
      <ul className="mt-3 space-y-2">
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
    <footer className="render-when-visible border-t border-border/40 bg-muted/10 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Brand tagline="API client for REST, GraphQL, gRPC and WebSocket" />
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">Free and open source. No account, and your collections stay on your machine.</p>
        </div>
      </div>
      <div className="mx-auto mt-8 grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {FOOTER_COLUMNS.map((column) => (
          <FooterColumn key={column.title} column={column} />
        ))}
      </div>
      <div className="mx-auto mt-8 flex max-w-6xl flex-col gap-4 border-t border-border/40 pt-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <AskAssistants />
          <a href={SPONSOR_URL} target="_blank" rel="noopener noreferrer" aria-label="Sponsor" title="Sponsor" className="rounded-sm transition-colors hover:text-foreground">
            <Heart className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  )
}
