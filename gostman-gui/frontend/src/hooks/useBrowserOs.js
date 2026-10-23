import { useSyncExternalStore } from "react"
import { detectBrowserOs } from "../lib/detectOs"

const unchanging = () => () => {}

const unknownBeforeHydration = () => null

export const useBrowserOs = () => useSyncExternalStore(unchanging, detectBrowserOs, unknownBeforeHydration)
