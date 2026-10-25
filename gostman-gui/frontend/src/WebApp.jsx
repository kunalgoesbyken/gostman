import { lazy, Suspense, useCallback, useEffect } from "react"
import { LandingPage } from "./components/LandingPage"
import { useRoute } from "./hooks/useRoute"
import { bootLanguage } from "./lib/i18n/boot"
import { registerServiceWorker } from "./lib/pwa"
import { preventInputZoom } from "./lib/viewport"

const WebWorkspace = lazy(async () => {
  await bootLanguage()
  const [{ Workspace }, { webBackend }] = await Promise.all([import("./components/Workspace"), import("./lib/backend/web")])
  return { default: (props) => <Workspace backend={webBackend} {...props} /> }
})

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
    return <LandingPage onGetStarted={openClient} />
  }

  return (
    <Suspense fallback={null}>
      <WebWorkspace onBack={openLanding} />
    </Suspense>
  )
}

export default WebApp
