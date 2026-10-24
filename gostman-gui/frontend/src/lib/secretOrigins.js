import { automaticSwatch, isColorChoice } from "./swatches.js"

const ORIGIN_ON = "on"
export const ORIGIN_OFF = "off"
export const ORIGIN_UNKNOWN = "unknown"

export const connectionColor = (connection) => (
  isColorChoice(connection.color) ? connection.color : automaticSwatch(connection.alias)
)

export const connectionDirectory = (connections) => new Map(connections.map((connection) => [connection.alias, connection]))

export function secretOrigin(ref, directory) {
  if (!ref || !directory) return null
  const connection = directory.get(ref.provider)
  if (!connection) return { ...ref, state: ORIGIN_UNKNOWN }
  return { ...ref, kind: connection.kind, color: connectionColor(connection), state: connection.disabled ? ORIGIN_OFF : ORIGIN_ON }
}
