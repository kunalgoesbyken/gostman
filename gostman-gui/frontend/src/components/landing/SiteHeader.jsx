import { buttonVariants } from "../ui/button"
import { cn } from "../../lib/utils"
import { Brand } from "./Brand"
import { NavBar } from "./NavBar"
import { Github } from "./icons"
import { docPath } from "../../docs/manifest"
import { RELEASES_URL, REPOSITORY_URL } from "../../lib/siteLinks"

const NAV_LINK = cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2 text-sm hover:bg-muted/50")

export function SiteHeader() {
  return (
    <NavBar>
      <a href="/" aria-label="Gostman home" className="shrink-0">
        <Brand />
      </a>
      <div className="flex items-center gap-1 sm:gap-2">
        <a href={docPath("")} className={NAV_LINK}>Docs</a>
        <a href="/web" className={NAV_LINK}>Web app</a>
        <a href={RELEASES_URL} rel="noopener" className={cn(NAV_LINK, "max-sm:hidden")}>Download</a>
        <a href={REPOSITORY_URL} rel="noopener" className={NAV_LINK}>
          <Github className="h-4 w-4" aria-hidden="true" />
          <span className="max-sm:sr-only">GitHub</span>
        </a>
      </div>
    </NavBar>
  )
}
