import { INTEGRATIONS } from "./integrations"

const COLUMNS = 13
const ROWS = 4
const CENTER_COLUMN = Math.floor(COLUMNS / 2)
const CENTER_ROW = 1

export const isLowered = (column) => (column - CENTER_COLUMN) % 2 === 0

const tileDistance = ({ column, row }) => Math.hypot((column - CENTER_COLUMN) * 1.2, row + (isLowered(column) ? 0.5 : 0) - CENTER_ROW - 0.5)

function layTiles() {
  const slots = Array.from({ length: COLUMNS * ROWS }, (_, index) => ({ column: index % COLUMNS, row: Math.floor(index / COLUMNS) }))
  const [center, ...nearest] = [...slots].sort((a, b) => tileDistance(a) - tileDistance(b))
  const toolOf = new Map(nearest.slice(0, INTEGRATIONS.length).map((slot, index) => [slot, INTEGRATIONS[index]]))
  const placed = slots.map((slot) => ({ ...slot, isCenter: slot === center, tool: toolOf.get(slot) }))
  return Array.from({ length: COLUMNS }, (_, column) => placed.filter((slot) => slot.column === column))
}

export const TILE_COLUMNS = layTiles()
