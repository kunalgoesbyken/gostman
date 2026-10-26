import { BrandIcon } from "../ui/brandIcon"
import { WEB_APP_URL } from "../../lib/constants"
import { LICENSE_URL } from "../../lib/siteLinks"
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
      <div className="mx-auto mt-14 flex max-w-6xl flex-col gap-4 border-t border-border/40 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <AskAssistants />
        <p>
          Free software under the{" "}
          <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
            MIT licence
          </a>
        </p>
      </div>
    </footer>
  )
}
