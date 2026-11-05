import { lazy, Suspense, useCallback, useEffect } from "react"
import { Analytics } from "@vercel/analytics/react"
import { AppSkeletonFrame } from "./components/AppSkeletonFrame"
import { LANDING_ROUTE, normalize, useRoute } from "./hooks/useRoute"
import { bootLanguage } from "./lib/i18n/boot"
import { revealApp } from "./lib/firstVisit"
import { onIdle } from "./lib/idle"
import { registerServiceWorker } from "./lib/pwa"
import { preventInputZoom } from "./lib/viewport"

const LandingPage = lazy(() => import("./components/LandingPage").then((module) => ({ default: module.LandingPage })))

const WebWorkspace = lazy(async () => {
  await bootLanguage()
  const [{ Workspace }, { webBackend }] = await Promise.all([import("./components/Workspace"), import("./lib/backend/web")])
  function OfflineReadyWorkspace(props) {
    useEffect(() => onIdle(registerServiceWorker), [])
    return <Workspace backend={webBackend} onShown={revealApp} {...props} />
  }
  return { default: OfflineReadyWorkspace }
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
    return preventInputZoom()
  }, [isLanding])

  if (isLanding) {
    return (
      <>
        <Suspense fallback={null}>
          <LandingPage onGetStarted={openClient} />
        </Suspense>
        <Analytics beforeSend={landingVisit} />
      </>
    )
  }

  return (
    <Suspense fallback={<AppSkeletonFrame />}>
      <WebWorkspace onBack={openLanding} />
    </Suspense>
  )
}

export default WebApp
