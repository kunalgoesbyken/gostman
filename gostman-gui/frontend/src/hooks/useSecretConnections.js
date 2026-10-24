import { useCallback, useEffect, useState } from "react"
import { useAppStore } from "../store/appStore"

const NOTHING = { connections: [], kinds: [], failure: "", isLoaded: false }

export function useSecretConnections(secrets) {
  const [state, setState] = useState(NOTHING)

  const reload = useCallback(async () => {
    if (!secrets) return
    try {
      const [kinds, connections] = await Promise.all([secrets.kinds(), secrets.connections()])
      setState({ kinds, connections, failure: "", isLoaded: true })
    } catch (error) {
      setState((current) => ({ ...current, failure: error.message, isLoaded: true }))
    }
  }, [secrets])

  useEffect(() => {
    reload()
    return secrets?.subscribe(reload)
  }, [secrets, reload])

  return state
}

export function useSharedSecretConnections(secrets) {
  const { connections, failure, isLoaded } = useSecretConnections(secrets)
  const setSecretConnections = useAppStore((state) => state.setSecretConnections)

  useEffect(() => {
    setSecretConnections(isLoaded && !failure ? connections : null)
  }, [connections, failure, isLoaded, setSecretConnections])
}
