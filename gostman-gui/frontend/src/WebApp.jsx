import { lazy, Suspense, useCallback, useEffect } from "react"
import { LandingPage } from "./components/LandingPage"
import { useRoute } from "./hooks/useRoute"
import { webBackend } from "./lib/backend/web"
import { whenIdle } from "./lib/idle"
import { registerServiceWorker } from "./lib/pwa"
import { preventInputZoom } from "./lib/viewport"

const loadWorkspace = () => import("./components/Workspace")

const Workspace = lazy(() => loadWorkspace().then((module) => ({ default: module.Workspace })))

function WebApp() {
  const { route, navigate } = useRoute()
  const openClient = useCallback(() => navigate("/web"), [navigate])
  const openLanding = useCallback(() => navigate("/"), [navigate])
  const isLanding = route === "/"

  useEffect(() => {
    if (isLanding) return whenIdle(loadWorkspace)
    registerServiceWorker()
    return preventInputZoom()
  }, [isLanding])

  if (isLanding) {
    return <LandingPage onGetStarted={openClient} />
  }

  return (
    <Suspense fallback={null}>
      <Workspace backend={webBackend} onBack={openLanding} />
    </Suspense>
  )
}

export default WebApp
