import { Suspense, lazy, useEffect, useState } from "react"
import { Close } from "../landing/icons"
import { DocsDialog } from "./DocsDialog"
import { DocsHeader } from "./DocsHeader"
import { DocsRail } from "./DocsRail"
import { DocsSearchButton } from "./DocsSearchButton"
import { DocsSidebar } from "./DocsSidebar"
import { DocsThemeSwitch } from "./DocsThemeSwitch"
import { DOCS_TEXT } from "../../lib/docsText"
import { watchCodeCopy } from "../../docs/copyCode"
import { watchSearchShortcut } from "../../docs/shortcuts"

const DocsSearch = lazy(() => import("./DocsSearch"))

const PANE = "sticky top-14 h-[calc(100dvh-3.5rem)] shrink-0"
const DRAWER =
  "docs-drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-80 max-w-[85vw] border-r border-border bg-background p-0 text-foreground backdrop:bg-foreground/20 dark:backdrop:bg-background/80"
const SEARCH =
  "docs-search m-auto mt-[12vh] w-[calc(100vw-2rem)] max-w-xl overflow-hidden rounded-lg border border-border bg-background p-0 text-foreground backdrop:bg-foreground/20 dark:backdrop:bg-background/80 max-sm:mt-4"

function Drawer({ nav, page, onClose, onSearch }) {
  const closeOnLink = (event) => {
    if (event.target.closest("a")) onClose()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-sm font-medium">{DOCS_TEXT.navLabel}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={DOCS_TEXT.closeMenu}
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Close className="h-5 w-5" />
        </button>
      </div>
      <div className="p-3">
        <DocsSearchButton onOpen={onSearch} />
      </div>
      <div data-scroll-container className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        <DocsSidebar nav={nav} currentHref={page.href} prefix="drawer" onNavigate={closeOnLink} />
      </div>
      <div className="border-t border-border px-4 py-3">
        <DocsThemeSwitch name="docs-theme-drawer" />
      </div>
    </div>
  )
}

export function DocsShell({ nav, page, searchUrl, content, footer }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [announcement, setAnnouncement] = useState("")

  const openSearch = () => {
    setMenuOpen(false)
    setSearchOpen(true)
  }

  useEffect(() => watchCodeCopy(setAnnouncement), [])
  useEffect(() => watchSearchShortcut(openSearch), [])

  return (
    <>
      <a href="#docs-main" className="skip-link">{DOCS_TEXT.skipLink}</a>
      <DocsHeader onSearch={openSearch} onMenu={() => setMenuOpen(true)} />
      <div className="mx-auto flex max-w-[90rem]">
        <aside className={`${PANE} hidden w-64 flex-col border-r border-border lg:flex`}>
          <div className="p-3">
            <DocsSearchButton onOpen={openSearch} />
          </div>
          <div data-scroll-container className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
            <DocsSidebar nav={nav} currentHref={page.href} prefix="sidebar" />
          </div>
          <div className="border-t border-border px-4 py-3">
            <DocsThemeSwitch name="docs-theme-sidebar" />
          </div>
        </aside>
        <main id="docs-main" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-24 pt-8 sm:px-8 lg:px-12 lg:pt-10">
          <div id="docs-content" className="mx-auto max-w-3xl" dangerouslySetInnerHTML={{ __html: content }} />
        </main>
        <aside className={`${PANE} hidden w-60 pt-10 xl:block`}>
          <DocsRail toc={page.toc} />
        </aside>
      </div>
      <div id="docs-footer" dangerouslySetInnerHTML={{ __html: footer }} />
      <DocsDialog open={menuOpen} onClose={() => setMenuOpen(false)} label={DOCS_TEXT.navLabel} className={DRAWER}>
        <Drawer nav={nav} page={page} onClose={() => setMenuOpen(false)} onSearch={openSearch} />
      </DocsDialog>
      <DocsDialog open={searchOpen} onClose={() => setSearchOpen(false)} label={DOCS_TEXT.search.label} className={SEARCH}>
        <Suspense fallback={null}>
          <DocsSearch url={searchUrl} nav={nav} onClose={() => setSearchOpen(false)} />
        </Suspense>
      </DocsDialog>
      <p role="status" className="sr-only">{announcement}</p>
    </>
  )
}
