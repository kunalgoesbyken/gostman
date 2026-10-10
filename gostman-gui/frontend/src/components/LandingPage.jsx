import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button, buttonVariants } from "./ui/button"
import { Badge } from "./ui/badge"
import { cn } from "../lib/utils"
import { easeSmooth, fadeIn, popIn, tapScale, springLayout } from "../lib/motion"
import {
  ArrowRight,
  Braces,
  Check,
  Code,
  Eye,
  FolderTree,
  Github,
  Globe,
  Import,
  KeyRound,
  Layers,
  Link2,
  Network,
  Radio,
  Search,
  Workflow,
} from "lucide-react"

import logo from "../assets/logo.jpg"

import {
  AnimatedSection,
  StaggerContainer,
  ScaleIn,
  SlideInFromRight,
} from "./landing/AnimatedSection"
import { RestShowcase, GraphQLShowcase, ChainingShowcase, WebSocketShowcase } from "./landing/showcases"
import { BackgroundCode } from "./landing/BackgroundCode"
import { DownloadDropdown } from "./landing/DownloadDropdown"

const REPOSITORY = "kunalgoesbyken/gostman"
const REPOSITORY_URL = `https://github.com/${REPOSITORY}`
const ISSUES_URL = `${REPOSITORY_URL}/issues`
const REPOSITORY_API_URL = `https://api.github.com/repos/${REPOSITORY}`

const HIGHLIGHTS = ["No account", "Data stored locally", "Open source"]

const FEATURES = [
  {
    icon: Network,
    title: "REST, GraphQL and WebSocket",
    description: "Send HTTP requests, GraphQL queries and WebSocket messages from the same window.",
  },
  {
    icon: Layers,
    title: "Environments and variables",
    description: "Keep a set of variables per environment and use them as {{name}} in URLs, headers and bodies.",
  },
  {
    icon: KeyRound,
    title: "Auth helpers",
    description: "Basic, bearer token and API key auth, added to the request for you.",
  },
  {
    icon: Braces,
    title: "Request bodies",
    description: "JSON, text, XML, URL-encoded forms, multipart forms with files, and single-file uploads.",
  },
  {
    icon: FolderTree,
    title: "Nested collections",
    description: "Organise saved requests in folders inside folders, with search and a history of what you sent.",
  },
  {
    icon: Workflow,
    title: "Response extraction",
    description: "Read a value from a JSON body, header, cookie or status code and save it to a variable for the next request.",
  },
  {
    icon: Search,
    title: "GraphQL schema browser",
    description: "Fetch a schema by introspection and search its types and fields.",
  },
  {
    icon: Eye,
    title: "Response preview and download",
    description: "View JSON, HTML, images and PDFs in the app, or save any response body to a file.",
  },
  {
    icon: Code,
    title: "Code generation",
    description: "Turn a request into cURL, JavaScript, Python, Go, PHP or Java.",
  },
  {
    icon: Import,
    title: "Import and export",
    description: "Import Postman v2.1 collections and OpenAPI 3 specs. Export to Postman, OpenAPI, Markdown or a Gostman backup.",
  },
]

const FACTS = [
  { label: "Desktop app", detail: "A native app built with Go and Wails, for Windows, macOS and Linux." },
  { label: "Web version", detail: "Runs in the browser. Requests are sent through a proxy because browsers block cross-origin calls." },
  { label: "Account", detail: "None. There is no sign-in." },
  { label: "Your data", detail: "The desktop app saves to a file on your disk. The web version saves to this browser's local storage." },
  { label: "Source", detail: "Open source under the MIT license." },
]

const SHOWCASE_TABS = [
  { id: "rest", label: "REST", icon: Network, description: "Send an HTTP request and read the response." },
  { id: "graphql", label: "GraphQL", icon: Braces, description: "Run queries and mutations with variables." },
  { id: "chaining", label: "Chaining", icon: Link2, description: "Save a value from one response and use it in the next request." },
  { id: "websocket", label: "WebSocket", icon: Radio, description: "Connect, send messages and read the replies." },
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

const TabButton = ({ tab, isActive, onClick }) => {
  const Icon = tab.icon
  return (
    <motion.button
      onClick={onClick}
      role="tab"
      aria-selected={isActive}
      aria-controls={`showcase-panel-${tab.id}`}
      id={`showcase-tab-${tab.id}`}
      tabIndex={isActive ? 0 : -1}
      className={cn(
        "relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200",
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
      {...tapScale}
    >
      {isActive && (
        <motion.span
          layoutId="activeShowcaseTab"
          className="absolute inset-0 -z-10 rounded-md bg-muted"
          transition={springLayout}
        />
      )}
      <Icon
        className={cn("h-4 w-4 transition-colors", isActive && "text-primary")}
        strokeWidth={2}
        aria-hidden="true"
      />
      <span className="whitespace-nowrap">{tab.label}</span>
    </motion.button>
  )
}

export function LandingPage({ onGetStarted }) {
  const [activeTab, setActiveTab] = useState("rest")
  const { stars, isLoading } = useGitHubStars()

  const activeDescription =
    SHOWCASE_TABS.find((tab) => tab.id === activeTab)?.description ?? ""

  const handleTabKeyDown = (event) => {
    const keyOffset = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    const isEdge = event.key === "Home" || event.key === "End"
    if (keyOffset === undefined && !isEdge) return

    event.preventDefault()
    const current = SHOWCASE_TABS.findIndex((tab) => tab.id === activeTab)
    const next = isEdge
      ? (event.key === "Home" ? 0 : SHOWCASE_TABS.length - 1)
      : (current + keyOffset + SHOWCASE_TABS.length) % SHOWCASE_TABS.length

    setActiveTab(SHOWCASE_TABS[next].id)
    document.getElementById(`showcase-tab-${SHOWCASE_TABS[next].id}`)?.focus()
  }

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
                <span className="block">An API client</span>
                <span className="block mt-2 text-muted-foreground">
                  for REST, GraphQL and WebSocket
                </span>
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-muted-foreground/90 max-w-2xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ willChange: "transform, opacity" }}
                transition={{ delay: 0.5, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                A native desktop app built with Go and Wails, with a web version for the browser. No account, and your data stays on your machine.
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

              <motion.div
                className="pt-6 flex justify-center"
                {...fadeIn}
                transition={{ delay: 1 }}
              >
                <Badge variant="outline" className="gap-2 px-3 py-1 text-xs bg-muted/20 border-border/40">
                  Built with Wails (Go and React)
                </Badge>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section className="relative py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <AnimatedSection className="mb-6" delay={0.1}>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                Watch a request go out and come back
              </h2>
              <p className="mt-3 max-w-xl text-muted-foreground leading-relaxed">
                {activeDescription}
              </p>
            </AnimatedSection>

            <AnimatedSection className="mb-5" delay={0.2}>
              <div
                role="tablist"
                aria-label="Protocol demos"
                onKeyDown={handleTabKeyDown}
                className="flex -mx-6 overflow-x-auto px-6 scrollbar-none"
              >
                <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border/40 bg-muted/20 p-1">
                  {SHOWCASE_TABS.map((tab) => (
                    <TabButton
                      key={tab.id}
                      tab={tab}
                      isActive={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                    />
                  ))}
                </div>
              </div>
            </AnimatedSection>

            <ScaleIn delay={0.3}>
              <div className="relative flex h-[600px] flex-col rounded-lg border border-border/60 p-4 sm:p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    role="tabpanel"
                    id={`showcase-panel-${activeTab}`}
                    aria-labelledby={`showcase-tab-${activeTab}`}
                    className="flex-1 min-h-0"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.28, ease: easeSmooth }}
                  >
                    {activeTab === "rest" && <RestShowcase />}
                    {activeTab === "graphql" && <GraphQLShowcase />}
                    {activeTab === "chaining" && <ChainingShowcase />}
                    {activeTab === "websocket" && <WebSocketShowcase />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </ScaleIn>
          </div>
        </section>

        <section className="relative py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <AnimatedSection className="mb-12 max-w-lg" delay={0.1}>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                What it does
              </h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                No account, no plugins and no workspace to join before the first request.
              </p>
            </AnimatedSection>

            <StaggerContainer className="grid border-t border-border/40 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-start gap-4 border-b border-border/40 py-8 sm:odd:pr-10 sm:even:pl-10 sm:even:border-l"
                >
                  <feature.icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={2} />
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-medium tracking-tight">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </StaggerContainer>
          </div>
        </section>

        <section className="relative py-20 px-6">
          <div className="max-w-3xl mx-auto">
            <AnimatedSection className="text-center mb-12" delay={0.1}>
              <h2 className="text-3xl md:text-4xl font-semibold mb-3">
                How it is built
              </h2>
              <p className="text-muted-foreground">
                What you get when you install it or open it in a browser.
              </p>
            </AnimatedSection>

            <SlideInFromRight delay={0.2}>
              <dl className="divide-y divide-border/30 border-y border-border/40">
                {FACTS.map((fact) => (
                  <div key={fact.label} className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
                    <dt className="text-sm font-medium">{fact.label}</dt>
                    <dd className="text-sm leading-relaxed text-muted-foreground sm:col-span-2">{fact.detail}</dd>
                  </div>
                ))}
              </dl>
            </SlideInFromRight>
          </div>
        </section>

        <section className="relative pb-20 px-6">
          <div className="max-w-3xl mx-auto">
            <AnimatedSection delay={0.1}>
              <div className="border-t border-border/40 pt-20 text-center">
                <motion.h2 className="text-3xl md:text-4xl font-semibold mb-4" {...revealUp()}>
                  Get Gostman
                </motion.h2>
                <motion.p className="text-muted-foreground mb-8 max-w-lg mx-auto" {...revealUp(0.1)}>
                  Download the desktop app, or open the web version in your browser.
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
                    API client for REST, GraphQL and WebSocket
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
