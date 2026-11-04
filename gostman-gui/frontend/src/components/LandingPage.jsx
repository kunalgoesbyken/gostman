import { useState, useEffect } from "react"
import { LazyMotion } from "framer-motion"
import { Button, buttonVariants } from "./ui/button"
import { cn } from "../lib/utils"
import { REPOSITORY, REPOSITORY_URL } from "../lib/siteLinks"
import { docPath } from "../docs/manifest"
import { useSmoothScroll } from "../lib/landingMotion"
import { ArrowRight, Download, Globe } from "./landing/icons"
import { BrandIcon } from "./ui/brandIcon"

import { ProductShowcase } from "./landing/ProductShowcase"
import { DownloadDropdown } from "./landing/DownloadDropdown"
import { DOWNLOADS, downloadFor, groupByOs } from "./landing/downloads"
import { useBrowserOs } from "../hooks/useBrowserOs"
import { InstallCommands } from "./landing/InstallCommands"
import { formatList } from "./landing/content"
import { Brand } from "./landing/Brand"
import { NavBar } from "./landing/NavBar"
import { FeatureSection } from "./landing/FeatureSection"
import { SiteFooter } from "./landing/SiteFooter"
import { SplitHeading } from "./landing/SplitHeading"
import { ComparisonSection } from "./landing/ComparisonSection"
import { FaqSection } from "./landing/FaqSection"
import { ImportSources } from "./landing/ImportSources"
import { StackSection } from "./landing/StackSection"
import { GlyphWordmark } from "./landing/GlyphWordmark"

const loadMotionFeatures = () => import("../lib/motionFeatures").then((module) => module.default)

const starCount = (value) => (Number.isFinite(value) ? value : null)

const REPOSITORY_API_URL = `https://api.github.com/repos/${REPOSITORY}`

const BUILD_STARS = typeof __GITHUB_STARS__ === "number" ? __GITHUB_STARS__ : null

const STAR_FORMAT = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })

const SECTION_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#compare", label: "Compare" },
  { href: "#faq", label: "FAQ" },
]

const PLATFORMS = [...groupByOs(DOWNLOADS).map((group) => group.name), "the web"]

const AVAILABILITY = `Open source · ${formatList(PLATFORMS)}`

const introStep = (step) => ({ "--intro-step": step })

const NAV_LINK = cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2 text-sm hover:bg-muted/50")

const isJsonResponse = (response) => response.ok && (response.headers.get("content-type") ?? "").includes("application/json")

async function latestStars(signal) {
  const own = await fetch("/api/stars", { signal })
  if (isJsonResponse(own)) return starCount((await own.json()).stars)
  const github = await fetch(REPOSITORY_API_URL, { signal })
  return isJsonResponse(github) ? starCount((await github.json()).stargazers_count) : null
}

const useGitHubStars = () => {
  const [stars, setStars] = useState(BUILD_STARS)

  useEffect(() => {
    const controller = new AbortController()
    latestStars(controller.signal)
      .then((count) => count !== null && setStars(count))
      .catch(() => {})
    return () => controller.abort()
  }, [])

  return stars
}

function GitHubStarLink({ stars }) {
  const label = stars === null ? `Star ${REPOSITORY} on GitHub` : `Star ${REPOSITORY} on GitHub, ${stars} stars`
  return (
    <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" aria-label={label} className={NAV_LINK}>
      <BrandIcon brand="github" className="h-4 w-4" />
      <span className="hidden font-medium sm:inline">Star</span>
      {stars !== null && (
        <span className="border-s border-border/70 ps-2 font-medium tabular-nums text-muted-foreground">{STAR_FORMAT.format(stars)}</span>
      )}
    </a>
  )
}

function TryWebButton({ onClick, isPrimary }) {
  return (
    <Button
      size="lg"
      variant={isPrimary ? "default" : "outline"}
      className={cn("gap-2 px-6 py-5.5 text-base", !isPrimary && "border-border/60 hover:bg-muted/50")}
      onClick={onClick}
    >
      <Globe className="h-4 w-4" />
      Try the web version
      <ArrowRight className="h-4 w-4" />
    </Button>
  )
}

function CallToActions({ onGetStarted, className, style }) {
  const os = useBrowserOs()
  const download = downloadFor(os)
  const isWebFirst = os !== null && !download
  return (
    <div className={cn("relative z-20 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center", className)} style={style}>
      <DownloadDropdown primary={download} variant={isWebFirst ? "outline" : undefined} />
      <TryWebButton onClick={onGetStarted} isPrimary={isWebFirst} />
    </div>
  )
}

export function LandingPage({ onGetStarted }) {
  const stars = useGitHubStars()

  useSmoothScroll()

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="dark min-h-screen bg-background text-foreground overflow-x-clip" id="main-content">
        <NavBar>
          <Brand />
          <div className="flex items-center gap-1 sm:gap-2">
            {SECTION_LINKS.map((link) => (
              <a key={link.href} href={link.href} className={cn(NAV_LINK, "max-md:hidden")}>
                {link.label}
              </a>
            ))}
            <a href={docPath("")} className={NAV_LINK}>
              Docs
            </a>
            <button type="button" onClick={onGetStarted} className={cn(NAV_LINK, "hidden sm:inline-flex")}>
              Web app
            </button>
            <GitHubStarLink stars={stars} />
            <a href="#download" className={buttonVariants({ size: "sm", className: "gap-2" })}>
              <Download className="h-4 w-4" />
              Download
            </a>
          </div>
        </NavBar>

        <div className="relative overflow-hidden">
          <section className="relative pt-36 pb-16 px-6">
            <div className="relative max-w-4xl mx-auto">
              <div className="text-center space-y-6">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.1] [text-wrap:balance]">
                  <span className="intro block">Gostman, the open source API client.</span>
                  <span className="intro block mt-2 text-muted-foreground" style={introStep(1)}>No account. No paid tier.</span>
                </h1>

                <p className="intro text-lg md:text-xl text-muted-foreground/90 max-w-3xl mx-auto leading-relaxed [text-wrap:balance]" style={introStep(2)}>
                  Gostman is a free Postman alternative for REST, GraphQL, gRPC and WebSocket. Collections are YAML files in Git, and secret values stay out of them.
                </p>

                <CallToActions onGetStarted={onGetStarted} className="intro pt-4" style={introStep(3)} />

                <p className="intro text-sm text-muted-foreground [text-wrap:balance]" style={introStep(3)}>{AVAILABILITY}</p>
              </div>
            </div>
          </section>

          <section className="relative py-16 px-6">
            <div className="landing-glow pointer-events-none absolute inset-x-0 -top-[15%] hidden h-[75%] md:block" aria-hidden="true" />
            <div className="relative max-w-5xl mx-auto">
              <ProductShowcase />
              <ImportSources className="mt-20" />
            </div>
          </section>
        </div>

        <FeatureSection />
        <ComparisonSection />
        <FaqSection />
        <StackSection />

        <section id="download" className="render-when-visible relative pt-24 text-center">
          <div className="mx-auto max-w-6xl px-6">
            <SplitHeading
              text="Send your first request in a minute"
              className="text-3xl md:text-5xl font-semibold tracking-tight [text-wrap:balance]"
            />
            <p className="mx-auto mt-5 max-w-lg leading-relaxed text-muted-foreground">
              Download the desktop app for Windows, macOS or Linux, or open the web version now. There is nothing to sign up for.
            </p>
            <CallToActions onGetStarted={onGetStarted} className="mt-8" />
            <p className="mt-6 text-sm text-muted-foreground">{AVAILABILITY}</p>
            <InstallCommands className="relative mx-auto mt-10 max-w-2xl text-left" />
          </div>
          <GlyphWordmark className="mt-20" />
        </section>

        <SiteFooter />
      </div>
    </LazyMotion>
  )
}
