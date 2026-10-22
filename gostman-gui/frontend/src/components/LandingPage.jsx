import { lazy, Suspense, useState, useEffect, useRef } from "react"
import { LazyMotion, m, useReducedMotion } from "framer-motion"
import { Button, buttonVariants } from "./ui/button"
import { cn } from "../lib/utils"
import { popIn } from "../lib/motion"
import { REPOSITORY, REPOSITORY_URL } from "../lib/siteLinks"
import { gsap, useReveal, useSmoothScroll } from "../lib/landingMotion"
import { ArrowRight, Check, Download, Github, Globe } from "./landing/icons"

import captureShot from "../assets/landing/capture.png"
import docsShot from "../assets/landing/docs.png"
import mockShot from "../assets/landing/mock.png"
import testsShot from "../assets/landing/tests.png"

import { AnimatedSection } from "./landing/AnimatedSection"
import { SplitHeading, SplitWords } from "./landing/SplitHeading"
import { AGENT_SESSION, CLI_RUN, REQUEST_FILE } from "./landing/captures"
import { TerminalBlock } from "./landing/TerminalBlock"
import { ProductShowcase } from "./landing/ProductShowcase"
import { BackgroundCode } from "./landing/BackgroundCode"
import { DownloadDropdown } from "./landing/DownloadDropdown"
import { Brand } from "./landing/Brand"
import { DotGrid } from "./landing/DotGrid"
import { NavBar } from "./landing/NavBar"
import { PointList } from "./landing/PointList"
import { SiteFooter } from "./landing/SiteFooter"
import { MountOnVisible } from "./landing/MountOnVisible"

const loadMotionFeatures = () => import("../lib/motionFeatures").then((module) => module.default)

const EverythingSection = lazy(() => import("./landing/EverythingSection"))

const starCount = (value) => (Number.isFinite(value) ? value : null)
const ComparisonSection = lazy(() => import("./landing/ComparisonSection"))

const REPOSITORY_API_URL = `https://api.github.com/repos/${REPOSITORY}`

const HIGHLIGHTS = ["No account", "Data stays on your machine", "Open source"]

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
    width: 864,
    height: 672,
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
    width: 767,
    height: 574,
    alt: "The mock server dialog with a served route and a live request log",
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
    width: 896,
    height: 640,
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
    width: 1240,
    height: 760,
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
  },
]

const useGitHubStars = () => {
  const [stars, setStars] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const controllerRef = useRef(null)

  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.abort()
    }

    const controller = new AbortController()
    controllerRef.current = controller

    const fetchStars = async () => {
      setIsLoading(true)
      try {
        const response = await fetch("/api/stars", { signal: controller.signal })
        const contentType = response.headers.get("content-type")
        if (!response.ok || (contentType && contentType.includes("text/html"))) {
          throw new Error("Local/API endpoint unavailable")
        }
        const data = await response.json()
        setStars(starCount(data.stars))
      } catch (err) {
        if (err.name === "AbortError") return
        try {
          const ghResponse = await fetch(REPOSITORY_API_URL, { signal: controller.signal })
          if (!ghResponse.ok) return
          const ghData = await ghResponse.json()
          setStars(starCount(ghData.stargazers_count))
        } catch {
          setStars(null)
        }
      } finally {
        setIsLoading(false)
      }
    }

    const timeoutId = setTimeout(fetchStars, 100)
    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [])

  return { stars, isLoading }
}

function Spotlight({ spotlight, isReversed }) {
  return (
    <AnimatedSection delay={0.1}>
      <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
        <div className={cn("lg:col-span-5", isReversed && "lg:order-2")}>
          <SplitHeading text={spotlight.title} className="text-2xl md:text-3xl font-semibold tracking-tight [text-wrap:balance]" />
          <p className="mt-4 leading-relaxed text-muted-foreground">{spotlight.description}</p>
          <PointList points={spotlight.points} className="mt-6 space-y-3" />
        </div>
        <div className={cn("lg:col-span-7", isReversed && "lg:order-1")}>
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
    </AnimatedSection>
  )
}

export function LandingPage({ onGetStarted }) {
  const { stars, isLoading } = useGitHubStars()
  const reduceMotion = useReducedMotion()
  const heroRef = useRef(null)

  useSmoothScroll()

  useReveal(heroRef, () => {
    gsap
      .timeline({ defaults: { ease: "power3.out" } })
      .from(".split-word", { opacity: 0, y: 28, duration: 0.7, stagger: 0.07 })
      .from("[data-intro=lede]", { opacity: 0, y: 16, duration: 0.6 }, "-=0.35")
      .from("[data-intro=actions]", { opacity: 0, y: 16, duration: 0.5 }, "-=0.4")
      .from("[data-intro=highlight]", { opacity: 0, y: 10, duration: 0.4, stagger: 0.08 }, "-=0.3")
  })

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="dark min-h-screen bg-background text-foreground overflow-x-clip" id="main-content">
        <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
          <DotGrid />
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-success/5 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.06),rgba(255,255,255,0))]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_50%,rgba(16,185,129,0.04),rgba(255,255,255,0))]" />
        </div>

        <BackgroundCode />

        <m.nav
          className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-6"
          initial={reduceMotion ? false : { y: -100 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        >
          <NavBar>
            <m.div
              initial={reduceMotion ? false : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Brand />
            </m.div>
            <m.div
              className="flex items-center gap-2"
              initial={reduceMotion ? false : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <a
                href={REPOSITORY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2 text-sm hover:bg-muted/50")}
              >
                <Github className="h-4 w-4" aria-hidden="true" />
                <span className="font-medium">Star</span>
                {stars !== null ? (
                  <m.span
                    className="font-mono text-xs text-muted-foreground"
                    {...(reduceMotion ? {} : popIn)}
                    key={stars}
                    aria-live="polite"
                  >
                    {stars.toLocaleString()}
                  </m.span>
                ) : isLoading ? (
                  <div className="h-4 w-8 bg-muted/20 animate-pulse rounded" />
                ) : null}
              </a>
            </m.div>
          </NavBar>
        </m.nav>

        <section ref={heroRef} className="relative pt-36 pb-16 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-6">
              <h1
                aria-label="Test any API. No account. No cloud."
                className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.1]"
              >
                <SplitWords className="block" text="Test any API." />
                <SplitWords className="block mt-2 text-muted-foreground" text="No account. No cloud." />
              </h1>

              <p
                data-intro="lede"
                className="text-lg md:text-xl text-muted-foreground/90 max-w-2xl mx-auto leading-relaxed"
              >
                Gostman is an open source client for REST, GraphQL, gRPC and WebSocket. One collection for you, your CI pipeline and your coding agent, kept as files on your machine.
              </p>

              <div
                data-intro="actions"
                className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6"
              >
                <DownloadDropdown />
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 text-base px-6 py-5.5 border-border/60 hover:bg-muted/50"
                  onClick={onGetStarted}
                >
                  <Globe className="h-4 w-4" />
                  Try the web version
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-center gap-6 pt-6 text-sm text-muted-foreground/80">
                {HIGHLIGHTS.map((text) => (
                  <div key={text} data-intro="highlight" className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-success/70" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <AnimatedSection delay={0.1}>
              <ProductShowcase />
            </AnimatedSection>
          </div>
        </section>

        <section className="relative py-20 px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-24">
            {SPOTLIGHTS.map((spotlight, index) => (
              <Spotlight key={spotlight.title} spotlight={spotlight} isReversed={index % 2 === 1} />
            ))}
          </div>
        </section>

        <div id="download" className="scroll-mt-24">
          <MountOnVisible minHeight={720}>
            <Suspense fallback={null}>
              <EverythingSection onGetStarted={onGetStarted} />
            </Suspense>
          </MountOnVisible>
        </div>

        <MountOnVisible>
          <Suspense fallback={null}>
            <ComparisonSection />
          </Suspense>
        </MountOnVisible>

        <section className="relative pb-20 px-6">
          <div className="max-w-3xl mx-auto">
            <AnimatedSection delay={0.1}>
              <div className="border-t border-border/40 pt-20 text-center">
                <SplitHeading
                  text="Send your first request in a minute"
                  className="text-3xl md:text-4xl font-semibold mb-4"
                />
                <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                  Download the desktop app for Windows, macOS or Linux, or open the web version now. There is nothing to sign up for.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <a href="#download" className={buttonVariants({ size: "lg", className: "gap-2" })}>
                    <Download className="h-4 w-4" />
                    Choose a download
                  </a>
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 border-border/60 hover:bg-muted/50"
                    onClick={onGetStarted}
                  >
                    <Globe className="h-4 w-4" />
                    Try the web version
                  </Button>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </section>

        <AnimatedSection>
          <SiteFooter />
        </AnimatedSection>
      </div>
    </LazyMotion>
  )
}
