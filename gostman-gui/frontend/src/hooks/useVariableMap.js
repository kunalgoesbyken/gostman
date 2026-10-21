import { useMemo } from "react"
import { parseVariableMap } from "../lib/placeholders"
import { selectActiveVariables, useAppStore } from "../store/appStore"

const NO_VARIABLES = new Map()

export function useVariableMap() {
  const text = useAppStore(selectActiveVariables)
  return useMemo(() => parseVariableMap(text) || NO_VARIABLES, [text])
}
