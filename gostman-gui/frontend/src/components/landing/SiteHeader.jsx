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
    <nav aria-label="Gostman" className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-6">
      <NavBar>
        <a href="/" aria-label="Gostman home">
          <Brand />
        </a>
        <div className="flex items-center gap-2">
          <a href={docPath("")} className={NAV_LINK}>Docs</a>
          <a href="/web" className={NAV_LINK}>Web app</a>
          <a href={RELEASES_URL} rel="noopener" className={NAV_LINK}>Download</a>
          <a href={REPOSITORY_URL} rel="noopener" className={NAV_LINK}>
            <Github className="h-4 w-4" />
            GitHub
          </a>
        </div>
      </NavBar>
    </nav>
  )
}
