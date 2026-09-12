import { useState, useEffect, useRef, lazy, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button, buttonVariants } from "./ui/button"
import { Badge } from "./ui/badge"
import { Card, CardContent } from "./ui/card"
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
import { FloatingCode } from "./landing/FloatingCode"
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

const COMPARISONS = [
  { feature: "Built with Go", gostman: true, others: false },
  { feature: "GraphQL & WebSocket", gostman: true, others: true },
  { feature: "Request Chaining", gostman: true, others: true },
  { feature: "Offline First", gostman: true, others: false },
  { feature: "No Account Required", gostman: true, others: false },
  { feature: "Lightweight (<50MB)", gostman: true, others: false },
  { feature: "Local Data Only", gostman: true, others: false },
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
        {/* Animated background */}
        <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
          {/* Subtle dot grid pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_1px_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:40px_40px]" />

          {/* Animated gradient orbs */}
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] animate-pulse bg-orb" />
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-success/5 rounded-full blur-[120px] animate-pulse bg-orb"
            style={{ animationDuration: "4s", animationDelay: "1s" }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] animate-pulse bg-orb"
            style={{ animationDuration: "5s", animationDelay: "2s" }}
          />

          {/* Moving gradient mesh */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.06),rgba(255,255,255,0))]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_50%,rgba(16,185,129,0.04),rgba(255,255,255,0))]" />
        </div>

        <FloatingCode />

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
                  <motion.span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-success mr-2"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  Open Source HTTP Client
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
                <span className="block">The HTTP Client</span>
                <span className="block mt-2 text-muted-foreground">
                  For the Go Era
                </span>
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-muted-foreground/90 max-w-2xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ willChange: "transform, opacity" }}
                transition={{ delay: 0.5, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                The Native HTTP Client.{" "}
                <motion.span
                  className="text-primary font-medium"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ willChange: "transform, opacity" }}
                  transition={{ delay: 0.8, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  10x lighter than Postman.
                </motion.span>
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
                  Try Web Version
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>

              <motion.div
                className="flex items-center justify-center gap-6 pt-6 text-sm text-muted-foreground/80"
                {...fadeIn}
                transition={{ delay: 0.8 }}
              >
                {["Free forever", "No account needed", "Open source"].map((text, i) => (
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
                  Powered by Wails (Go + React)
                </Badge>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features in Action Section */}
        <section className="relative py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <AnimatedSection className="text-center mb-8" delay={0.1}>
              <Badge variant="outline" className="px-3 py-1 text-xs font-medium border-primary/30 bg-primary/5 text-primary mb-4">
                Interactive Demo
              </Badge>
              <h2 className="text-3xl md:text-4xl font-semibold mb-3">
                See It In Action
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                See it handle any API protocol
              </p>
            </AnimatedSection>

            {/* Tab Navigation */}
            <AnimatedSection delay={0.2}>
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-2 p-1.5 rounded-xl bg-muted/20 border border-border/40">
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
          <div className="max-w-6xl mx-auto">
            <AnimatedSection className="mb-12" delay={0.1}>
              <h2 className="text-3xl md:text-4xl font-semibold mb-3">
                Everything You Need
              </h2>
              <p className="text-muted-foreground max-w-xl">
                Crafted by developers, for developers
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
          <div className="max-w-3xl mx-auto">
            <AnimatedSection className="text-center mb-12" delay={0.1}>
              <h2 className="text-3xl md:text-4xl font-semibold mb-3">
                Why Choose Gostman?
              </h2>
              <p className="text-muted-foreground">
                Fast, lightweight, private
              </p>
            </AnimatedSection>

            <SlideInFromRight delay={0.2}>
              <Card className="border border-border/60 bg-background/40 backdrop-blur-sm overflow-hidden">
                <CardContent className="p-0">
                  {/* Table Header */}
                  <div className="grid grid-cols-3 gap-4 p-6 border-b border-border/40 bg-muted/10">
                    <div className="font-medium text-sm">Feature</div>
                    <div className="text-center">
                      <span className="font-medium text-sm">Gostman</span>
                      <Badge variant="outline" className="ml-2 text-xs bg-primary/10 text-primary border-primary/20">
                        Go
                      </Badge>
                    </div>
                    <div className="text-center font-medium text-sm text-muted-foreground">Others</div>
                  </div>

                  {/* Table Rows */}
                  <div className="divide-y divide-border/30">
                    {COMPARISONS.map((item, index) => (
                      <motion.div
                        key={item.feature}
                        className="grid grid-cols-3 gap-4 py-4 px-6 items-center hover:bg-muted/20 transition-colors"
                        initial={slideInLeft.initial}
                        whileInView={slideInLeft.animate}
                        viewport={VIEWPORT_ONCE}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="text-sm flex items-center">{item.feature}</div>
                        <div className="flex items-center justify-center">
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
                        <div className="flex items-center justify-center">
                          {item.others ? (
                            <Check className="h-5 w-5 text-success/70" strokeWidth={2.5} />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground/30" strokeWidth={2} />
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </SlideInFromRight>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-20 px-6">
          <div className="max-w-3xl mx-auto">
            <AnimatedSection delay={0.1}>
              <motion.div
                className="relative rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-12 text-center"
                whileHover={{ scale: 1.01 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                {/* Animated background elements - contained in overflow-hidden wrapper */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl">
                  <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />
                  <div className="absolute bottom-0 right-0 w-64 h-64 bg-success/5 rounded-full blur-[80px]" />
                </div>

                <div className="relative">
                  <motion.h2 className="text-3xl md:text-4xl font-semibold mb-4" {...revealUp()}>
                    Ready to Go Native?
                  </motion.h2>
                  <motion.p className="text-muted-foreground mb-8 max-w-lg mx-auto" {...revealUp(0.1)}>
                    Join thousands who switched to a lighter, faster HTTP client.
                    Download now.
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
                      Try Web Version
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            </AnimatedSection>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/40 bg-muted/10 py-16 px-6">
          <div className="max-w-6xl mx-auto">
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
