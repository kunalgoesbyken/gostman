import { lazy, Suspense, useCallback, useEffect } from "react"
import { Analytics } from "@vercel/analytics/react"
import { LandingPage } from "./components/LandingPage"
import { LANDING_ROUTE, normalize, useRoute } from "./hooks/useRoute"
import { bootLanguage } from "./lib/i18n/boot"
import { registerServiceWorker } from "./lib/pwa"
import { preventInputZoom } from "./lib/viewport"

const WebWorkspace = lazy(async () => {
  await bootLanguage()
  const [{ Workspace }, { webBackend }] = await Promise.all([import("./components/Workspace"), import("./lib/backend/web")])
  return { default: (props) => <Workspace backend={webBackend} {...props} /> }
})

function landingVisit(event) {
  const url = new URL(event.url)
  if (normalize(url.pathname) !== LANDING_ROUTE) return null
  url.hash = ""
  return { ...event, url: url.href }
}

function WebApp() {
  const { route, navigate } = useRoute()
  const openClient = useCallback(() => navigate("/web"), [navigate])
  const openLanding = useCallback(() => navigate("/"), [navigate])
  const isLanding = route === "/"

  useEffect(() => {
    if (isLanding) return undefined
    registerServiceWorker()
    return preventInputZoom()
  }, [isLanding])

  if (isLanding) {
    return (
      <>
        <LandingPage onGetStarted={openClient} />
        <Analytics beforeSend={landingVisit} />
      </>
    )
  }

  return (
    <Suspense fallback={null}>
      <WebWorkspace onBack={openLanding} />
    </Suspense>
  )
}

export default WebApp
