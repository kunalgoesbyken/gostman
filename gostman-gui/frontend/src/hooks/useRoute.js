import { useCallback, useEffect, useState } from "react"

export const LANDING_ROUTE = "/"
const ROUTES = [LANDING_ROUTE, "/web"]

export const normalize = (pathname) => {
  const path = pathname.replace(/\/+$/, "") || LANDING_ROUTE
  return ROUTES.includes(path) ? path : LANDING_ROUTE
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
