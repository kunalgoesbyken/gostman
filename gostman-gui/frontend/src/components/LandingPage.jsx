import { useState, useEffect } from "react"
import { LazyMotion } from "framer-motion"
import { Button, buttonVariants } from "./ui/button"
import { cn } from "../lib/utils"
import { REPOSITORY, REPOSITORY_URL } from "../lib/siteLinks"
import { docPath } from "../docs/manifest"
import { useSmoothScroll } from "../lib/landingMotion"
import { ArrowRight, Check, Download, Globe } from "./landing/icons"
import { BrandIcon, BrandStrip } from "./ui/brandIcon"

import captureShot from "../assets/landing/capture.webp"
import docsShot from "../assets/landing/docs.webp"
import mockShot from "../assets/landing/mock.webp"
import testsShot from "../assets/landing/tests.webp"

import { AGENT_SESSION, CLI_RUN, REQUEST_FILE } from "./landing/captures"
import { TerminalBlock } from "./landing/TerminalBlock"
import { ProductShowcase } from "./landing/ProductShowcase"
import { DownloadDropdown } from "./landing/DownloadDropdown"
import { DOWNLOADS, downloadFor, groupByOs } from "./landing/downloads"
import { useBrowserOs } from "../hooks/useBrowserOs"
import { InstallCommands } from "./landing/InstallCommands"
import { formatList } from "./landing/content"
import { Brand } from "./landing/Brand"
import { NavBar } from "./landing/NavBar"
import { PointList } from "./landing/PointList"
import { SiteFooter } from "./landing/SiteFooter"
import { SplitHeading } from "./landing/SplitHeading"
import { EverythingSection } from "./landing/EverythingSection"
import { ComparisonSection } from "./landing/ComparisonSection"
import { FaqSection } from "./landing/FaqSection"
import { AnnouncementBar } from "./landing/AnnouncementBar"
import { SectionLabel } from "./landing/SectionLabel"
import { ImportSources } from "./landing/ImportSources"
import { StackSection } from "./landing/StackSection"
import { GlyphWordmark } from "./landing/GlyphWordmark"

const loadMotionFeatures = () => import("../lib/motionFeatures").then((module) => module.default)

const starCount = (value) => (Number.isFinite(value) ? value : null)

const REPOSITORY_API_URL = `https://api.github.com/repos/${REPOSITORY}`

const BUILD_STARS = typeof __GITHUB_STARS__ === "number" ? __GITHUB_STARS__ : null

const STAR_FORMAT = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })

const HIGHLIGHTS = ["Open source, MIT licence", "Collections stay on your machine", "Share through Git or a link"]

const SECTION_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#compare", label: "Compare" },
  { href: "#faq", label: "FAQ" },
]

const PLATFORMS = formatList(groupByOs(DOWNLOADS).map((group) => group.name))

const introStep = (step) => ({ "--intro-step": step })

const NAV_LINK = cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2 text-sm hover:bg-muted/50")

const SPOTLIGHTS = [
  {
    title: "Tests that run every time you press Send",
    description: "Add checks as plain rows, or write a script with test() and expect(). The results sit beside the response, so a broken contract shows up on the request that broke it.",
    points: [
      "Checks on status, headers, body and response time",
      "Pre-request and post-response scripts, run in a sandbox",
      "A runner in the app for a whole folder at once",
    ],
    image: testsShot,
    width: 1400,
    height: 761,
    alt: "A request with four assertion rows and a passing test list under the response",
  },
  {
    title: "The same checks in CI, from one binary",
    description: "gostman run sends every request in a folder with its scripts, variables and cookies, prints what failed and why, and exits non-zero so the pipeline stops. There is no runtime to install.",
    points: [
      "Text, JSON and JUnit reports",
      "Secrets passed from the environment, never stored in the collection",
      "Linux, macOS and Windows builds on every release",
    ],
    capture: CLI_RUN,
    brands: ["linux", "macos", "windows"],
  },
  {
    title: "A collection you can read in a pull request",
    description: "Open a folder and every request becomes a small YAML file: one file per request, one directory per folder. Commit it next to the code it tests and review changes line by line.",
    points: [
      "Tokens, cookies and history never reach the folder",
      "A cloned folder runs no scripts until you trust it",
      "The app, the command line and your agent all read the same files",
    ],
    capture: REQUEST_FILE,
  },
  {
    title: "A mock server from the responses you saved",
    description: "Save any response as an example, then start a local server that answers each route with it. Build the frontend before the API exists, and watch every request it makes arrive in the log.",
    points: [
      "Pick which example each route returns while the server runs",
      "Optional delay and CORS for browser clients",
      "Also available as gostman mock and to agents over MCP",
    ],
    image: mockShot,
    width: 1400,
    height: 1050,
    alt: "The mock server dialog running on port 4010, listing each route with the saved example it serves",
  },
  {
    title: "Turn real traffic into a collection",
    description: "Point your app at a local address and Gostman forwards every call to your API while listing each one live. Save any of them as a request, with its response kept as an example. There is no certificate to install.",
    points: [
      "Works for any app whose API base URL you can change",
      "Authorization and cookie headers are never saved",
      "In the desktop app and as gostman capture",
    ],
    image: captureShot,
    width: 1400,
    height: 1000,
    alt: "The capture dialog listing five forwarded calls with the response of one shown below",
  },
  {
    title: "Share it or publish it without an account",
    description: "Send a folder as an encrypted link or file that is built in your own window and never uploaded, or turn the collection into a single documentation page you can host anywhere.",
    points: [
      "Variable values and saved responses stay out unless you include them",
      "The recipient sees what is inside before importing",
      "One self-contained HTML file, from the app or gostman docs",
    ],
    image: docsShot,
    width: 1860,
    height: 1162,
    alt: "A generated documentation page with a sidebar of requests and the details of one",
  },
  {
    title: "Hand the same collection to your coding agent",
    description: "Claude Code, Codex and Cursor can call Gostman through MCP in place of curl. They use the collection you already have, and variable values and credentials are filled in inside Gostman and replaced with their names in everything the agent reads.",
    points: [
      "Cookies, tokens and variables carry across calls in a session",
      "Responses are capped and can be narrowed to the fields that matter",
      "Agents reach only the hosts your collection already uses, unless you allow more",
    ],
    capture: AGENT_SESSION,
    brands: ["claude", "openai", "cursor"],
  },
]

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

function Spotlight({ spotlight, isReversed }) {
  return (
    <div className="grid items-center gap-8 p-6 md:p-10 lg:grid-cols-12 lg:gap-12 lg:p-12">
      <div className={cn("min-w-0 lg:col-span-5", isReversed && "lg:order-2")}>
        <SplitHeading as="h3" text={spotlight.title} className="text-2xl md:text-3xl font-semibold tracking-tight [text-wrap:balance]" />
        <p className="mt-4 leading-relaxed text-muted-foreground">{spotlight.description}</p>
        <BrandStrip brands={spotlight.brands} className="mt-4" />
        <PointList points={spotlight.points} className="mt-6 space-y-3" />
      </div>
      <div className={cn("reveal-on-scroll min-w-0 lg:col-span-7", isReversed && "lg:order-1")}>
        {spotlight.capture ? (
          <TerminalBlock {...spotlight.capture} />
        ) : (
          <img
            src={spotlight.image}
            alt={spotlight.alt}
            width={spotlight.width}
            height={spotlight.height}
            loading="lazy"
            decoding="async"
            className="h-auto w-full rounded-lg border border-border/60"
          />
        )}
      </div>
    </div>
  )
}

function BlueprintRails({ children }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-full max-w-[75rem] -translate-x-1/2 border-x border-dashed border-border/40 lg:block" aria-hidden="true" />
      {children}
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
        <NavBar banner={<AnnouncementBar />}>
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
          <div className="landing-stripes pointer-events-none absolute inset-x-0 top-0 h-[760px]" aria-hidden="true" />
          <section className="relative pt-44 pb-16 px-6">
            <div className="relative max-w-4xl mx-auto">
              <div className="text-center space-y-6">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.1] [text-wrap:balance]">
                  <span className="intro block">Test any API.</span>
                  <span className="intro block mt-2 text-muted-foreground" style={introStep(1)}>No account. No paid tier.</span>
                </h1>

                <p className="intro text-lg md:text-xl text-muted-foreground/90 max-w-2xl mx-auto leading-relaxed" style={introStep(2)}>
                  Gostman is an open source client for REST, GraphQL, gRPC and WebSocket that keeps your collections as files on your machine. Tests, a command line for CI, a mock server and sharing with your team are all in the free download.
                </p>

                <CallToActions onGetStarted={onGetStarted} className="intro pt-6" style={introStep(3)} />

                <div className="intro flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-6 text-sm text-muted-foreground" style={introStep(4)}>
                  {HIGHLIGHTS.map((text) => (
                    <div key={text} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-success/70" />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="relative py-16 px-6">
            <div className="landing-glow pointer-events-none absolute inset-x-0 -top-[15%] hidden h-[75%] md:block" aria-hidden="true" />
            <div className="landing-horizon pointer-events-none absolute left-1/2 top-[30%] hidden h-[160%] w-[150%] -translate-x-1/2 md:block" aria-hidden="true" />
            <div className="relative max-w-5xl mx-auto">
              <ProductShowcase />
              <ImportSources className="mt-20" />
            </div>
          </section>
        </div>

        <BlueprintRails>
          <section id="features" className="render-when-visible relative py-20 px-6" aria-labelledby="workflow-heading">
            <div className="mx-auto max-w-6xl">
              <div className="mb-12 max-w-2xl">
                <SectionLabel number="001" label="Workflow" />
                <SplitHeading
                  id="workflow-heading"
                  text="One collection, from the first request to CI"
                  className="text-3xl font-semibold tracking-tight md:text-5xl [text-wrap:balance]"
                />
                <p className="mt-5 leading-relaxed text-muted-foreground">
                  Tests, the command line, Git, mocks, captured traffic, sharing and your coding agent all work from the same files.
                </p>
              </div>
              <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/40 lg:-mx-6 lg:rounded-none lg:border-x-0 lg:bg-transparent">
                {SPOTLIGHTS.map((spotlight, index) => (
                  <Spotlight key={spotlight.title} spotlight={spotlight} isReversed={index % 2 === 1} />
                ))}
              </div>
            </div>
          </section>

          <EverythingSection onGetStarted={onGetStarted} />
          <ComparisonSection />
          <FaqSection />
          <StackSection />
        </BlueprintRails>

        <section className="render-when-visible relative pt-24 text-center">
          <div className="mx-auto max-w-6xl px-6">
            <SplitHeading
              text="Send your first request in a minute"
              className="text-3xl md:text-5xl font-semibold tracking-tight [text-wrap:balance]"
            />
            <p className="mx-auto mt-5 max-w-lg leading-relaxed text-muted-foreground">
              Download the desktop app for Windows, macOS or Linux, or open the web version now. There is nothing to sign up for.
            </p>
            <CallToActions onGetStarted={onGetStarted} className="mt-8" />
            <p className="mt-6 text-sm text-muted-foreground">Free and open source · {PLATFORMS} · No account</p>
            <InstallCommands className="relative mx-auto mt-10 max-w-2xl text-left" />
          </div>
          <GlyphWordmark className="mt-20" />
        </section>

        <SiteFooter />
      </div>
    </LazyMotion>
  )
}
