import { buttonVariants } from "./ui/button"
import { cn } from "../lib/utils"
import { Brand } from "./landing/Brand"
import { DotGrid } from "./landing/DotGrid"
import { NavBar } from "./landing/NavBar"
import { PointList } from "./landing/PointList"
import { SiteFooter } from "./landing/SiteFooter"
import { Github } from "./landing/icons"
import { REPOSITORY_URL, RELEASES_URL } from "../lib/siteLinks"

const NAV_LINK = cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2 text-sm hover:bg-muted/50")
const BODY_TEXT = "mt-4 leading-relaxed text-muted-foreground"

function LinkRow({ links }) {
  return (
    <p className={cn(BODY_TEXT, "flex flex-wrap gap-x-6 gap-y-2")}>
      {links.map((link) => (
        <a key={link.href} href={link.href} rel="noopener" className="text-primary underline-offset-4 hover:underline">
          {link.label}
        </a>
      ))}
    </p>
  )
}

function Section({ block }) {
  return (
    <section className="mt-14">
      <h2 className="text-2xl font-semibold tracking-tight">{block.heading}</h2>
      {block.paragraphs?.map((text) => (
        <p key={text} className={BODY_TEXT}>{text}</p>
      ))}
      {block.items ? <PointList points={block.items} className="mt-5 space-y-3" /> : null}
      {block.links ? <LinkRow links={block.links} /> : null}
    </section>
  )
}

export function GuidePage({ page }) {
  return (
    <div className="dark min-h-screen bg-background text-foreground overflow-x-clip">
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <DotGrid />
      </div>

      <nav aria-label="Gostman" className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-6">
        <NavBar>
          <a href="/" aria-label="Gostman home">
            <Brand />
          </a>
          <div className="flex items-center gap-2">
            <a href="/web" className={NAV_LINK}>Web app</a>
            <a href={RELEASES_URL} rel="noopener" className={NAV_LINK}>Download</a>
            <a href={REPOSITORY_URL} rel="noopener" className={NAV_LINK}>
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </NavBar>
      </nav>

      <main className="relative mx-auto max-w-3xl px-6 pt-36 pb-20">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] [text-wrap:balance]">{page.heading}</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{page.intro}</p>
        {page.code ? (
          <pre className="mt-8 overflow-x-auto rounded-lg border border-border/60 bg-card p-4 font-mono text-sm">
            <code>{page.code}</code>
          </pre>
        ) : null}
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <a href="/web" className={cn(buttonVariants({ size: "lg" }), "text-base px-6")}>
            Open the web app
          </a>
          <a href={RELEASES_URL} rel="noopener" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "text-base px-6 border-border/60 hover:bg-muted/50")}>
            Download for Windows, macOS and Linux
          </a>
        </div>
        {page.sections.map((block) => (
          <Section key={block.heading} block={block} />
        ))}
        {page.links ? <LinkRow links={page.links} /> : null}
      </main>

      <SiteFooter />
    </div>
  )
}
