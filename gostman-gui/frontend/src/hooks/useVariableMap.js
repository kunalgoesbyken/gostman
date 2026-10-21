import { useMemo } from "react"
import { variableMap } from "../lib/variableScopes"
import { selectResolvedVariables, useAppStore } from "../store/appStore"

export function useVariableMap() {
  const resolved = useAppStore(selectResolvedVariables)
  return useMemo(() => variableMap(resolved), [resolved])
}
