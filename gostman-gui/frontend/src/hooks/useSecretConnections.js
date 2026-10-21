import { useCallback, useEffect, useState } from "react"

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
  }, [reload])

  return { ...state, reload }
}
