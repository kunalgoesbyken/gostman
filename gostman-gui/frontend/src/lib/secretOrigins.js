import { lookup } from "./dataUtils"
import { ENVIRONMENT_COLORS } from "./environmentText"

const ORIGIN_ON = "on"
export const ORIGIN_OFF = "off"
export const ORIGIN_UNKNOWN = "unknown"

const NEUTRAL_COLOR = "gray"
const AUTOMATIC_COLORS = Object.keys(ENVIRONMENT_COLORS).filter((color) => color !== NEUTRAL_COLOR)

const textHash = (text) => Array.from(text).reduce((hash, char) => (hash * 31 + char.codePointAt(0)) >>> 0, 0)

export const automaticColor = (alias) => AUTOMATIC_COLORS[textHash(alias) % AUTOMATIC_COLORS.length]

export const connectionColor = (connection) => (
  lookup(ENVIRONMENT_COLORS, connection.color) ? connection.color : automaticColor(connection.alias)
)

export const connectionDirectory = (connections) => new Map(connections.map((connection) => [connection.alias, connection]))

export function secretOrigin(ref, directory) {
  if (!ref || !directory) return null
  const connection = directory.get(ref.provider)
  if (!connection) return { ...ref, state: ORIGIN_UNKNOWN }
  return { ...ref, kind: connection.kind, color: connectionColor(connection), state: connection.disabled ? ORIGIN_OFF : ORIGIN_ON }
}
