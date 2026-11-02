export const ROW_PX = 28
export const NODE_WIDTH_PX = 240
export const GAP_PX = 96
export const PADDING_PX = 12
export const LABEL_CHARS = 30

const columnX = (column) => PADDING_PX + column * (NODE_WIDTH_PX + GAP_PX)

const rowY = (row) => PADDING_PX + row * ROW_PX

const unique = (ids) => [...new Set(ids)]

const nodesOf = (ids, column) => ids.map((id, row) => ({ id, x: columnX(column), y: rowY(row) }))

const centerOf = (node) => node.y + ROW_PX / 2

export function truncated(text, limit = LABEL_CHARS) {
  const characters = Array.from(text)
  return characters.length <= limit ? text : `${characters.slice(0, limit - 1).join('')}…`
}

function edgesOf(variableNodes, producerNodes, consumerNodes) {
  const producerAt = new Map(producerNodes.map((node) => [node.id, node]))
  const consumerAt = new Map(consumerNodes.map((node) => [node.id, node]))
  return variableNodes.flatMap((node) => [
    ...node.variable.producers.map((id) => ({ key: `p:${id}:${node.id}`, from: { x: columnX(0) + NODE_WIDTH_PX, y: centerOf(producerAt.get(id)) }, to: { x: node.x, y: centerOf(node) } })),
    ...node.variable.consumers.map((id) => ({ key: `c:${node.id}:${id}`, from: { x: node.x + NODE_WIDTH_PX, y: centerOf(node) }, to: { x: columnX(2), y: centerOf(consumerAt.get(id)) } })),
  ])
}

export function layoutGraph(variables) {
  const producerNodes = nodesOf(unique(variables.flatMap((variable) => variable.producers)), 0)
  const consumerNodes = nodesOf(unique(variables.flatMap((variable) => variable.consumers)), 2)
  const variableNodes = variables.map((variable, row) => ({ id: variable.name, variable, x: columnX(1), y: rowY(row) }))
  const rows = Math.max(producerNodes.length, consumerNodes.length, variableNodes.length)
  return {
    producerNodes,
    variableNodes,
    consumerNodes,
    edges: edgesOf(variableNodes, producerNodes, consumerNodes),
    width: columnX(3) - GAP_PX + PADDING_PX,
    height: rowY(rows) + PADDING_PX,
  }
}
