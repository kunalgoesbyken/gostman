import github from "@iconify-icons/simple-icons/github"
import { Brand } from "../landing/Brand"
import { SvgIcon } from "../ui/svgIcon"
import { Menu, Search } from "../landing/icons"
import { DOCS_TEXT } from "../../lib/docsText"
import { docPath } from "../../docs/manifest"
import { RELEASES_URL, REPOSITORY_URL } from "../../lib/siteLinks"

const LINK = "inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
const ICON_BUTTON = "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground lg:hidden"

export function DocsHeader({ onSearch, onMenu }) {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background">
      <div className="mx-auto flex h-full max-w-[90rem] items-center gap-3 px-4 sm:px-6">
        <a href="/" aria-label={DOCS_TEXT.home} className="shrink-0">
          <Brand />
        </a>
        <span aria-hidden="true" className="text-muted-foreground/50">/</span>
        <a href={docPath("")} className="text-sm font-medium text-foreground">
          {DOCS_TEXT.docs}
        </a>
        <nav aria-label={DOCS_TEXT.home} className="ml-auto flex items-center gap-1">
          <a href="/web" className={`${LINK} max-md:hidden`}>{DOCS_TEXT.links.webApp}</a>
          <a href={RELEASES_URL} rel="noopener" className={`${LINK} max-md:hidden`}>{DOCS_TEXT.links.download}</a>
          <a href={REPOSITORY_URL} rel="noopener" className={`${LINK} max-sm:hidden`}>
            <SvgIcon icon={github} className="h-4 w-4" />
            <span className="max-lg:sr-only">{DOCS_TEXT.links.github}</span>
          </a>
          <button type="button" onClick={onSearch} aria-label={DOCS_TEXT.search.open} aria-haspopup="dialog" className={ICON_BUTTON}>
            <Search className="h-5 w-5" />
          </button>
          <button type="button" onClick={onMenu} aria-label={DOCS_TEXT.openMenu} aria-haspopup="dialog" className={ICON_BUTTON}>
            <Menu className="h-5 w-5" />
          </button>
        </nav>
      </div>
    </header>
  )
}
