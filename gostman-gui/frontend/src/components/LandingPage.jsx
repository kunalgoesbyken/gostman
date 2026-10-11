import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Button, buttonVariants } from "./ui/button"
import { Badge } from "./ui/badge"
import { cn } from "../lib/utils"
import { easeSmooth, fadeIn, popIn } from "../lib/motion"
import { ArrowRight, Check, Github, Globe } from "lucide-react"

import logo from "../assets/logo.jpg"
import captureShot from "../assets/landing/capture.png"
import docsShot from "../assets/landing/docs.png"
import mockShot from "../assets/landing/mock.png"
import testsShot from "../assets/landing/tests.png"

import { AnimatedSection } from "./landing/AnimatedSection"
import { AGENT_SESSION, CLI_RUN, REQUEST_FILE } from "./landing/captures"
import { TerminalBlock } from "./landing/TerminalBlock"
import { ProductShowcase } from "./landing/ProductShowcase"
import { BackgroundCode } from "./landing/BackgroundCode"
import { DownloadDropdown } from "./landing/DownloadDropdown"

const REPOSITORY = "kunalgoesbyken/gostman"
const REPOSITORY_URL = `https://github.com/${REPOSITORY}`
const ISSUES_URL = `${REPOSITORY_URL}/issues`
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

const CAPABILITIES = [
  {
    title: "Protocols",
    items: ["REST with any method", "GraphQL with a schema browser", "gRPC through reflection or .proto files", "WebSocket with a live message log", "MCP servers over Streamable HTTP"],
  },
  {
    title: "Requests",
    items: ["JSON, XML, form, multipart and file bodies", "Basic, bearer, API key and OAuth 2.0 with renewal", "Environments and {{variables}} everywhere", "A cookie jar, proxy and client certificates", "Paste a curl command to turn it into a request"],
  },
  {
    title: "Responses",
    items: ["JSON tree, HTML, image and PDF previews", "Headers, cookies, size and timing", "Download any body, including binary", "Code in cURL, JavaScript, Python, Go, PHP and Java"],
  },
  {
    title: "Your data",
    items: ["Nested collections, tabs and history", "Plain YAML files in a folder, or app storage", "Import from Postman and OpenAPI", "Export to Postman, OpenAPI, Markdown or a backup"],
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
        setStars(data.stars)
      } catch (err) {
        if (err.name === "AbortError") return
        try {
          const ghResponse = await fetch(REPOSITORY_API_URL, { signal: controller.signal })
          if (!ghResponse.ok) return
          const ghData = await ghResponse.json()
          setStars(ghData.stargazers_count)
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

const VIEWPORT_ONCE = { once: true }

const revealUp = (delay) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: VIEWPORT_ONCE,
  ...(delay ? { transition: { delay } } : {}),
})

function Spotlight({ spotlight, isReversed }) {
  return (
    <AnimatedSection delay={0.1}>
      <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
        <div className={cn("lg:col-span-5", isReversed && "lg:order-2")}>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight [text-wrap:balance]">{spotlight.title}</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">{spotlight.description}</p>
          <ul className="mt-6 space-y-3">
            {spotlight.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-foreground/90">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success/80" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={cn("lg:col-span-7", isReversed && "lg:order-1")}>
          {spotlight.capture ? (
            <TerminalBlock {...spotlight.capture} />
          ) : (
            <img
              src={spotlight.image}
              alt={spotlight.alt}
              loading="lazy"
              className="w-full rounded-lg border border-border/60"
            />
          )}
        </div>
      </div>
    </AnimatedSection>
  )
}

export function LandingPage({ onGetStarted }) {
  const { stars, isLoading } = useGitHubStars()

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="min-h-screen bg-background text-foreground overflow-hidden" id="main-content">
        <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_1px_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:40px_40px]" />
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-success/5 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.06),rgba(255,255,255,0))]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_50%,rgba(16,185,129,0.04),rgba(255,255,255,0))]" />
        </div>

        <BackgroundCode />

        <motion.nav
          className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-6"
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        >
          <div className="max-w-5xl w-full backdrop-blur-xl bg-background/75 border border-border/40 rounded-2xl shadow-md">
            <div className="px-5 py-3 flex items-center justify-between">
              <motion.div
                className="flex items-center gap-2.5"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <img
                  src={logo}
                  alt="Gostman Logo"
                  className="h-8 w-8 rounded-md"
                />
                <span className="font-medium text-sm">Gostman</span>
              </motion.div>
              <motion.div
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: 20 }}
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
                    <motion.span
                      className="font-mono text-xs text-muted-foreground"
                      {...popIn}
                      key={stars}
                      aria-live="polite"
                    >
                      {stars.toLocaleString()}
                    </motion.span>
                  ) : isLoading ? (
                    <div className="h-4 w-8 bg-muted/20 animate-pulse rounded" />
                  ) : null}
                </a>
              </motion.div>
            </div>
          </div>
        </motion.nav>

        <section className="relative pt-36 pb-16 px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="text-center space-y-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: easeSmooth }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <Badge variant="outline" className="px-3 py-1 text-xs font-medium border-border/60 bg-muted/30">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-success mr-2" />
                  Open source API client
                </Badge>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.8 }}
                className="flex justify-center"
              >
                <a href="https://peerlist.io/kunalrc/project/gostman" target="_blank" rel="noreferrer">
                  <img
                    src="https://peerlist.io/api/v1/projects/embed/PRJHA9EGOA6EQB87M3JRKKDPEO8D8M?showUpvote=true&theme=dark"
                    alt="Gostman"
                    style={{ width: "auto", height: "72px" }}
                  />
                </a>
              </motion.div>

              <motion.h1
                className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.1]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
              >
                <span className="block">Test any API.</span>
                <span className="block mt-2 text-muted-foreground">
                  No account. No cloud.
                </span>
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-muted-foreground/90 max-w-2xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ willChange: "transform, opacity" }}
                transition={{ delay: 0.5, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
Gostman is an open source client for REST, GraphQL, gRPC and WebSocket. One collection for you, your CI pipeline and your coding agent, kept as files on your machine.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
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
              </motion.div>

              <motion.div
                className="flex items-center justify-center gap-6 pt-6 text-sm text-muted-foreground/80"
                {...fadeIn}
                transition={{ delay: 0.8 }}
              >
                {HIGHLIGHTS.map((text, i) => (
                  <motion.div
                    key={text}
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                  >
                    <Check className="h-3.5 w-3.5 text-success/70" />
                    <span>{text}</span>
                  </motion.div>
                ))}
              </motion.div>

            </motion.div>
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

        <section className="relative py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <AnimatedSection className="mb-10 max-w-xl" delay={0.1}>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight [text-wrap:balance]">
                And the rest of what an API client should do
              </h2>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <div className="grid gap-x-10 gap-y-10 border-t border-border/40 pt-10 sm:grid-cols-2 lg:grid-cols-4">
                {CAPABILITIES.map((group) => (
                  <div key={group.title}>
                    <h3 className="text-sm font-medium">{group.title}</h3>
                    <ul className="mt-4 space-y-2.5">
                      {group.items.map((item) => (
                        <li key={item} className="text-sm leading-relaxed text-muted-foreground">{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </section>

        <section className="relative pb-20 px-6">
          <div className="max-w-3xl mx-auto">
            <AnimatedSection delay={0.1}>
              <div className="border-t border-border/40 pt-20 text-center">
                <motion.h2 className="text-3xl md:text-4xl font-semibold mb-4" {...revealUp()}>
                  Send your first request in a minute
                </motion.h2>
                <motion.p className="text-muted-foreground mb-8 max-w-lg mx-auto" {...revealUp(0.1)}>
                  Download the desktop app for Windows, macOS or Linux, or open the web version now. There is nothing to sign up for.
                </motion.p>
                <motion.div
                  className="flex flex-col sm:flex-row items-center justify-center gap-4"
                  {...revealUp(0.2)}
                >
                  <DownloadDropdown />
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 border-border/60 hover:bg-muted/50"
                    onClick={onGetStarted}
                  >
                    <Globe className="h-4 w-4" />
                    Try the web version
                  </Button>
                </motion.div>
              </div>
            </AnimatedSection>
          </div>
        </section>

        <footer className="border-t border-border/40 bg-muted/10 py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              className="flex flex-col md:flex-row items-center justify-between gap-8"
              {...revealUp()}
            >
              <div className="flex items-center gap-3">
                <img
                  src={logo}
                  alt="Gostman Logo"
                  className="h-8 w-8 rounded-md"
                />
                <div>
                  <span className="font-medium text-sm">Gostman</span>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    API client for REST, GraphQL, gRPC and WebSocket
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <a
                  href={REPOSITORY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-6 items-center gap-2 text-sm text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
                <a
                  href={ISSUES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-6 items-center text-sm text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  Report an issue
                </a>
              </div>
            </motion.div>

            <motion.div
              className="mt-12 pt-8 border-t border-border/40 text-center"
              initial={fadeIn.initial}
              whileInView={fadeIn.animate}
              viewport={VIEWPORT_ONCE}
              transition={{ delay: 0.2 }}
            >
              <p className="text-sm text-muted-foreground/60">
                Gostman is open source under the MIT license.
              </p>
            </motion.div>
          </div>
        </footer>
      </div>
    </>
  )
}
