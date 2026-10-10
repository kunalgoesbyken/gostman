import { useCallback } from "react"
import { LandingPage } from "./components/LandingPage"
import { Workspace } from "./components/Workspace"
import { useRoute } from "./hooks/useRoute"
import { webBackend } from "./lib/backend/web"

function WebApp() {
  const { route, navigate } = useRoute()
  const openClient = useCallback(() => navigate("/web"), [navigate])
  const openLanding = useCallback(() => navigate("/"), [navigate])

  if (route === "/") {
    return <LandingPage onGetStarted={openClient} />
  }

  return <Workspace backend={webBackend} onBack={openLanding} />
}

export default WebApp
