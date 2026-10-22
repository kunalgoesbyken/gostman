import { Brand } from "./Brand"
import { Github } from "./icons"
import { guidePages } from "../../guides/pages"
import { docPath } from "../../docs/manifest"
import { ISSUES_URL, REPOSITORY_URL } from "../../lib/siteLinks"

const DOCS_LINK = { path: docPath("").slice(1), heading: "Documentation" }
const FOOTER_LINK = "text-sm text-muted-foreground/70 transition-colors hover:text-foreground"

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 bg-muted/10 py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <Brand tagline="API client for REST, GraphQL, gRPC and WebSocket" />
          <div className="flex items-center gap-8">
            <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className={`flex min-h-6 items-center gap-2 ${FOOTER_LINK}`}>
              <Github className="h-4 w-4" />
              GitHub
            </a>
            <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className={`flex min-h-6 items-center ${FOOTER_LINK}`}>
              Report an issue
            </a>
          </div>
        </div>

        <nav aria-label="Guides" className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {[DOCS_LINK, ...guidePages].map((page) => (
            <a key={page.path} href={`/${page.path}`} className={FOOTER_LINK}>
              {page.heading}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
