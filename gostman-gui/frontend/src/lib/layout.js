import { readStored, writeStored } from "./storage"

export const MIN_REQUEST_HEIGHT_PX = 232
export const MIN_RESPONSE_HEIGHT_PX = 120
export const DEFAULT_RESPONSE_SHARE = 55
const NARROW_VIEWPORT_QUERY = "(max-width: 767px)"
const RESPONSE_SHARE_KEY = "gostman.responseShare"
const SIDEBAR_OPEN_KEY = "gostman.sidebarOpen"
const MIN_SHARE = 5
const MAX_SHARE = 95

export const isNarrowViewport = () => typeof window !== "undefined" && window.matchMedia(NARROW_VIEWPORT_QUERY).matches

export const clamp = (value, lowest, highest) => Math.max(lowest, Math.min(highest, value))

function storedNumber(key, lowest, highest, fallback) {
  const value = Number(readStored(key))
  return value >= lowest && value <= highest ? value : fallback
}

export const rememberedResponseShare = () => storedNumber(RESPONSE_SHARE_KEY, MIN_SHARE, MAX_SHARE, DEFAULT_RESPONSE_SHARE)

export const rememberResponseShare = (share) => writeStored(RESPONSE_SHARE_KEY, String(Math.round(share)))

export const rememberedSidebarOpen = () => !isNarrowViewport() && readStored(SIDEBAR_OPEN_KEY) !== "false"

export function rememberSidebarOpen(isOpen) {
  if (!isNarrowViewport()) writeStored(SIDEBAR_OPEN_KEY, String(isOpen))
}

const PANE_WIDTH_VAR = "--pane-width"

const paneSpec = (storageKey, min, fallback, max, minMain, widthVar = PANE_WIDTH_VAR) => ({ storageKey, min, fallback, max, minMain, widthVar })

export const SIDEBAR_PANE = paneSpec("gostman.sidebarWidth", 224, 312, 480, 480, "--sidebar-width")
export const FLOW_PANE = paneSpec("gostman.flowPaneWidth", 320, 512, 800, 360)
export const GRAPHQL_SCHEMA_PANE = paneSpec("gostman.graphqlSchemaWidth", 208, 320, 560, 280)
export const GRAPHQL_BUILDER_PANE = paneSpec("gostman.graphqlBuilderWidth", 256, 448, 720, 280)
export const MCP_SCHEMA_PANE = paneSpec("gostman.mcpSchemaWidth", 208, 448, 720, 280)
export const ENVIRONMENT_PANE = paneSpec("gostman.environmentListWidth", 160, 224, 420, 320)
export const EXAMPLES_PANE = paneSpec("gostman.examplesListWidth", 160, 224, 420, 320)
export const PREFERENCES_PANE = paneSpec("gostman.preferencesListWidth", 144, 176, 320, 360)
export const SPEC_PANE = paneSpec("gostman.specListWidth", 192, 288, 560, 320)
export const GIT_CHANGES_PANE = paneSpec("gostman.gitChangesWidth", 224, 320, 640, 320)
export const GIT_HISTORY_PANE = paneSpec("gostman.gitHistoryWidth", 224, 320, 640, 320)

export const rememberedPaneWidth = (pane) => storedNumber(pane.storageKey, pane.min, pane.max, pane.fallback)

export const rememberPaneWidth = (pane, width) => writeStored(pane.storageKey, String(Math.round(width)))

export const widestPaneFor = (pane, containerWidth) => clamp(containerWidth - pane.minMain, pane.min, pane.max)

export const paneWidthValue = (pane, width) => `min(${width}px, 100% - ${pane.minMain}px)`

export const paneWidthStyle = (pane, width) => ({ [pane.widthVar]: paneWidthValue(pane, width) })

export const sidebarWidthStyle = (width) => paneWidthStyle(SIDEBAR_PANE, width)

export const rememberedSidebarWidth = () => rememberedPaneWidth(SIDEBAR_PANE)
