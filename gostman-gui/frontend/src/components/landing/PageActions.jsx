import { BrandStrip } from "../ui/brandIcon"
import { buttonVariants } from "../ui/button"
import { cn } from "../../lib/utils"
import { RELEASES_URL } from "../../lib/siteLinks"

const DESKTOP_PLATFORMS = ["windows", "macos", "linux"]

export function PageActions({ className }) {
  return (
    <div className={cn("flex flex-col sm:flex-row gap-3", className)}>
      <a href="/web" className={cn(buttonVariants({ size: "lg" }), "text-base px-6")}>
        Open the web app
      </a>
      <a href={RELEASES_URL} rel="noopener" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-auto whitespace-normal py-3 text-center text-base px-6 border-border/60 hover:bg-muted/50")}>
        <BrandStrip brands={DESKTOP_PLATFORMS} className="shrink-0 flex-nowrap gap-1.5 text-current" />
        Download for Windows, macOS and Linux
      </a>
    </div>
  )
}
