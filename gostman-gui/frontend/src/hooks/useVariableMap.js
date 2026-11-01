import { createContext, useContext, useMemo } from "react"
import { variableMap } from "../lib/variableScopes"
import { selectResolvedVariables, useAppStore } from "../store/appStore"

const ExtraVariables = createContext(null)

export const ExtraVariablesProvider = ExtraVariables.Provider

export function useVariableMap() {
  const resolved = useAppStore(selectResolvedVariables)
  const connections = useAppStore((state) => state.secretConnections)
  const extra = useContext(ExtraVariables)
  return useMemo(() => variableMap(extra ? new Map([...resolved, ...extra]) : resolved, connections), [resolved, connections, extra])
}
