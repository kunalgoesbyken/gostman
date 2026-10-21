import { lazy, Suspense, useCallback } from "react"
import { LandingPage } from "./components/LandingPage"
import { useRoute } from "./hooks/useRoute"
import { webBackend } from "./lib/backend/web"

const Workspace = lazy(() => import("./components/Workspace").then((module) => ({ default: module.Workspace })))

function WebApp() {
  const { route, navigate } = useRoute()
  const openClient = useCallback(() => navigate("/web"), [navigate])
  const openLanding = useCallback(() => navigate("/"), [navigate])

  if (route === "/") {
    return <LandingPage onGetStarted={openClient} />
  }

  return (
    <Suspense fallback={null}>
      <Workspace backend={webBackend} onBack={openLanding} />
    </Suspense>
  )
}

export default WebApp
