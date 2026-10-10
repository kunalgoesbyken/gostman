import { useCallback, useEffect, useState } from "react"

const ROUTES = ["/", "/web"]

const normalize = (pathname) => {
  const path = pathname.replace(/\/+$/, "") || "/"
  return ROUTES.includes(path) ? path : "/"
}

export function useRoute() {
  const [route, setRoute] = useState(() => normalize(window.location.pathname))

  useEffect(() => {
    const onPopState = () => setRoute(normalize(window.location.pathname))
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    if (normalize(window.location.pathname) !== window.location.pathname) {
      window.history.replaceState(null, "", route)
    }
  }, [route])

  const navigate = useCallback((to) => {
    const next = normalize(to)
    if (next === normalize(window.location.pathname)) return
    window.history.pushState(null, "", next)
    setRoute(next)
  }, [])

  return { route, navigate }
}
