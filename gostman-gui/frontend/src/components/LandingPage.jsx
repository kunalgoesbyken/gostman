import { useState, useEffect, useRef, lazy, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button, buttonVariants } from "./ui/button"
import { cn } from "../lib/utils"
import { easeSmooth, fadeIn, popIn, pressable, slideInLeft, springLayout } from "../lib/motion"
import {
  Zap,
  Globe,
  Github,
  ArrowRight,
  Check,
  X,
  Braces,
  Shield,
  Network,
  Workflow,
  TestTube,
  Import,
  Radio,
  Link2,
} from "lucide-react"

import logo from "../assets/logo.jpg"

import {
  AnimatedSection,
  StaggerContainer,
  ScaleIn,
  SlideInFromRight,
} from "./landing/AnimatedSection"
import { RestShowcase, GraphQLShowcase, ChainingShowcase, WebSocketShowcase } from "./landing/showcases"
import { DownloadDropdown } from "./landing/DownloadDropdown"

function ShowcaseSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="space-y-4 w-full max-w-md">
        <div className="h-4 bg-muted/20 rounded animate-pulse w-1/3" />
        <div className="h-32 bg-muted/10 rounded animate-pulse" />
        <div className="h-24 bg-muted/10 rounded animate-pulse" />
      </div>
    </div>
  )
}

const FEATURES = [
  {
    icon: Network,
    title: "Multi-Protocol",
    description: "REST, GraphQL and WebSocket requests in one window, with no mode switching.",
  },
  {
    icon: Workflow,
    title: "Request Chaining",
    description: "Pull a token or id out of one response with JSONPath and feed it to the next request.",
  },
  {
    icon: TestTube,
    title: "Response Extraction",
    description: "Capture any field into an environment variable the moment a response lands.",
  },
  {
    icon: Import,
    title: "Postman Import",
    description: "Bring collections and environments across as they are. Export whenever you want out.",
  },
  {
    icon: Zap,
    title: "Opens Instantly",
    description: "A Go backend and a native window. No splash screen, no sign-in, no workspace sync.",
  },
  {
    icon: Shield,
    title: "Stays On Your Machine",
    description: "Requests, history and secrets are written to local disk. Nothing leaves the device.",
  },
]

// Counts, not adjectives. Each one is checkable against the source.
const HERO_FACTS = [
  { label: "Protocols", value: "REST · GraphQL · WebSocket" },
  { label: "Platforms", value: "macOS · Windows · Linux" },
  { label: "Code export", value: "6 languages" },
  { label: "Data leaves your machine", value: "Never" },
]

const COMPARISONS = [
  { feature: "Works with no account", gostman: true, others: false },
  { feature: "Works offline", gostman: true, others: false },
  { feature: "Collections stay on local disk", gostman: true, others: false },
  { feature: "No workspace sync to opt out of", gostman: true, others: false },
  { feature: "GraphQL and WebSocket", gostman: true, others: true },
  { feature: "Request chaining", gostman: true, others: true },
  { feature: "Postman import", gostman: true, others: true },
]

const SHOWCASE_TABS = [
  { id: "rest", label: "REST API", icon: Network, description: "HTTP requests with full control" },
  { id: "graphql", label: "GraphQL", icon: Braces, description: "Queries, mutations & subscriptions" },
  { id: "chaining", label: "Chaining", icon: Link2, description: "Chain requests with data extraction" },
  { id: "websocket", label: "WebSocket", icon: Radio, description: "Real-time bidirectional messaging" },
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
          const ghResponse = await fetch("https://api.github.com/repos/krockxz/gostman", {
            signal: controller.signal,
          })
          if (!ghResponse.ok) throw new Error("GitHub API failed")
          const ghData = await ghResponse.json()
          setStars(ghData.stargazers_count)
        } catch (ghErr) {
          if (ghErr.name !== "AbortError") {
            console.error("Failed to fetch stars:", ghErr)
          }
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
      aria-pressed={isActive}
      aria-selected={isActive}
      role="tab"
      tabIndex={0}
      className={cn(
        "relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "text-foreground bg-background/80 shadow-lg border border-border/60"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
      )}
      {...pressable}
    >
      <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "")} aria-hidden="true" />
      <span>{tab.label}</span>
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-background/80 rounded-lg border border-border/60 -z-10"
          transition={springLayout}
        />
      )}
    </motion.button>
  )
}

export function LandingPage({ onGetStarted }) {
  const [activeTab, setActiveTab] = useState("rest")
  const { stars, isLoading } = useGitHubStars()

  return (
    <>
      {/* Skip link for accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="min-h-screen bg-background text-foreground overflow-hidden" id="main-content">
        <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_1px_at_1px_1px,hsl(var(--foreground)/0.05)_1px,transparent_0)] [background-size:40px_40px]" />
          <div className="absolute inset-x-0 top-0 h-[60vh] bg-[linear-gradient(to_bottom,hsl(var(--primary)/0.06),transparent)]" />
        </div>

        {/* Navigation */}
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
                <motion.img
                  src={logo}
                  alt="Gostman Logo"
                  className="h-8 w-8 rounded-md"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
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
                  href="https://github.com/krockxz/gostman"
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

        {/* Hero Section */}
        <section className="relative pt-36 pb-14 px-6">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="max-w-3xl"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: easeSmooth }}
            >
              <motion.p
                className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground"
                {...fadeIn}
                transition={{ delay: 0.15 }}
              >
                Go + Wails desktop app
              </motion.p>

              <motion.h1
                className="mt-5 text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.7 }}
              >
                Send the request.
                <span className="block text-muted-foreground">Keep the data.</span>
              </motion.h1>

              <motion.p
                className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                An HTTP client for REST, GraphQL and WebSocket that opens in a native
                window and writes everything to local disk. No account, no sync, no
                telemetry.
              </motion.p>

              <motion.div
                className="mt-9 flex flex-col sm:flex-row items-start gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <DownloadDropdown />
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 text-base px-6 py-5.5 border-border/60 hover:bg-muted/50"
                  onClick={onGetStarted}
                >
                  <Globe className="h-4 w-4" />
                  Try in the browser
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>

              <motion.dl
                className="mt-12 grid grid-cols-2 sm:flex sm:flex-wrap gap-x-8 sm:gap-x-12 gap-y-5 border-t border-border/40 pt-6"
                {...fadeIn}
                transition={{ delay: 0.65 }}
              >
                {HERO_FACTS.map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 font-mono text-sm">{value}</dd>
                  </div>
                ))}
              </motion.dl>
            </motion.div>
          </div>
        </section>

        {/* Features in Action Section */}
        <section className="relative py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <AnimatedSection className="mb-8" delay={0.1}>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                One window, every protocol
              </h2>
              <p className="mt-3 text-muted-foreground max-w-xl">
                REST, GraphQL and WebSocket share the same tabs, history and variables.
                Switching protocol does not mean switching mode.
              </p>
            </AnimatedSection>

            {/* Tab Navigation */}
            <AnimatedSection delay={0.2}>
              <div className="flex mb-6 -mx-6 px-6 overflow-x-auto scrollbar-thin">
                <div className="inline-flex items-center gap-2 p-1.5 rounded-xl bg-muted/20 border border-border/40 shrink-0">
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

            {/* Showcase Panel */}
            <ScaleIn delay={0.3}>
              <motion.div
                className="bg-background/40 backdrop-blur-sm rounded-2xl border border-border/60 p-6 min-h-[480px]"
                layout
              >
                <AnimatePresence mode="wait">
                  <Suspense fallback={<ShowcaseSkeleton />}>
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      {activeTab === "rest" && <RestShowcase />}
                      {activeTab === "graphql" && <GraphQLShowcase />}
                      {activeTab === "chaining" && <ChainingShowcase />}
                      {activeTab === "websocket" && <WebSocketShowcase />}
                    </motion.div>
                  </Suspense>
                </AnimatePresence>
              </motion.div>
            </ScaleIn>
          </div>
        </section>

        {/* Features Section */}
        <section className="relative py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <AnimatedSection className="mb-12" delay={0.1}>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                What it does
              </h2>
              <p className="mt-3 text-muted-foreground max-w-xl">
                No plugins to install and no paid tier holding anything back.
              </p>
            </AnimatedSection>

            <StaggerContainer className="grid sm:grid-cols-2 gap-x-14 border-t border-border/40">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="group flex items-start gap-4 py-7 border-b border-border/40"
                >
                  <feature.icon
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary"
                    strokeWidth={1.5}
                  />
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-medium tracking-tight">{feature.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground/70 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </StaggerContainer>
          </div>
        </section>

        {/* Comparison Section */}
        <section className="relative py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <AnimatedSection className="mb-10" delay={0.1}>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                Where it differs
              </h2>
              <p className="mt-3 text-muted-foreground max-w-xl">
                Most of this is table stakes. The difference is what happens to your
                collections when you close the window.
              </p>
            </AnimatedSection>

            <SlideInFromRight delay={0.2}>
              <div>
                  {/* Table Header */}
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 sm:gap-x-10 pb-3 border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
                    <div>Feature</div>
                    <div className="w-16 sm:w-20 text-center font-medium text-foreground">Gostman</div>
                    <div className="w-16 sm:w-20 text-center">Others</div>
                  </div>

                  {/* Table Rows */}
                  <div>
                    {COMPARISONS.map((item, index) => (
                      <motion.div
                        key={item.feature}
                        className="grid grid-cols-[1fr_auto_auto] gap-x-4 sm:gap-x-10 py-3.5 items-center border-b border-border/30"
                        initial={slideInLeft.initial}
                        whileInView={slideInLeft.animate}
                        viewport={VIEWPORT_ONCE}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="text-sm">{item.feature}</div>
                        <div className="w-16 sm:w-20 flex items-center justify-center">
                          {item.gostman ? (
                            <motion.div
                              initial={popIn.initial}
                              whileInView={popIn.animate}
                              viewport={VIEWPORT_ONCE}
                              transition={{ delay: index * 0.05 + 0.1, type: "spring", stiffness: 200 }}
                            >
                              <Check className="h-5 w-5 text-success/70" strokeWidth={2.5} />
                            </motion.div>
                          ) : (
                            <span className="text-muted-foreground/60">-</span>
                          )}
                        </div>
                        <div className="w-16 sm:w-20 flex items-center justify-center">
                          {item.others ? (
                            <Check className="h-5 w-5 text-success/70" strokeWidth={2.5} />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground/30" strokeWidth={2} />
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
              </div>
            </SlideInFromRight>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-20 px-6">
          <div className="max-w-5xl mx-auto border-t border-border/40 pt-14">
            <AnimatedSection delay={0.1}>
              <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                <div className="max-w-md">
                  <motion.h2 className="text-3xl font-semibold tracking-tight" {...revealUp()}>
                    Try it on one endpoint
                  </motion.h2>
                  <motion.p className="mt-3 text-muted-foreground" {...revealUp(0.1)}>
                    The browser version needs nothing installed. The desktop build adds
                    local disk storage and WebSocket headers the browser will not send.
                  </motion.p>
                </div>
                <motion.div className="flex flex-col sm:flex-row gap-3" {...revealUp(0.2)}>
                  <DownloadDropdown />
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 border-border/60 hover:bg-muted/50"
                    onClick={onGetStarted}
                  >
                    <Globe className="h-4 w-4" />
                    Try in the browser
                  </Button>
                </motion.div>
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/40 bg-muted/10 py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="flex flex-col md:flex-row items-center justify-between gap-8"
              {...revealUp()}
            >
              <div className="flex items-center gap-3">
                <motion.img
                  src={logo}
                  alt="Gostman Logo"
                  className="h-8 w-8 rounded-md"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                />
                <div>
                  <span className="font-medium text-sm">Gostman</span>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    A lightweight HTTP client for developers
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <a
                  href="https://github.com/krockxz/gostman"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
                <a
                  href="https://github.com/krockxz/gostman/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors"
                >
                  Report Issue
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
                © 2025 Gostman. Open source, always free.
              </p>
            </motion.div>
          </div>
        </footer>
      </div>
    </>
  )
}
