import { useSyncExternalStore } from "react"

const unchanging = () => () => {}

const noFrame = () => null

export const useWindowFrame = (source) => useSyncExternalStore(source?.subscribe ?? unchanging, source?.current ?? noFrame, noFrame)

export const awaitsRestart = (frame) => frame.systemTitleBar === frame.frameless
