import { useCallback, useEffect, useState } from "react"

const ROUTES = ["/", "/web"]

const normalize = (pathname) => {
  const path = pathname.replace(/\/+$/, "") || "/"
  return ROUTES.includes(path) ? path : "/"
}

/**
 * Two-route history binding for the web build: "/" is the landing page and
 * "/web" is the HTTP client.
 *
 * The URL is the single source of truth rather than a boolean in the store, so
 * the browser's back/forward buttons work, /web can be linked to directly, and
 * a refresh keeps you where you were. An unknown path resolves to "/" and is
 * replaced in history so it does not become a dead back-stack entry.
 */
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
