import { useMemo } from "react"
import { variableMap } from "../lib/variableScopes"
import { selectResolvedVariables, useAppStore } from "../store/appStore"

export function useVariableMap() {
  const resolved = useAppStore(selectResolvedVariables)
  const connections = useAppStore((state) => state.secretConnections)
  return useMemo(() => variableMap(resolved, connections), [resolved, connections])
}
