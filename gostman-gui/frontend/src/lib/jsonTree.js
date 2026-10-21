export const MAX_TREE_CHILDREN = 200
export const MAX_TREE_NODES = 5000

const isContainer = (value) => value !== null && typeof value === 'object'

const remainder = (count, noun) => `${count} more ${noun} not shown`

export function trimTree(value, maxChildren = MAX_TREE_CHILDREN, maxNodes = MAX_TREE_NODES) {
  let budget = maxNodes
  let omitted = 0

  function visit(node) {
    if (!isContainer(node)) return node
    const isList = Array.isArray(node)
    const entries = isList ? node.map((item, index) => [index, item]) : Object.entries(node)
    const allowed = Math.max(Math.min(maxChildren, budget), 0)
    const kept = entries.slice(0, allowed)
    budget -= kept.length
    const copy = isList ? [] : {}
    kept.forEach(([key, item]) => {
      const trimmed = visit(item)
      if (isList) copy.push(trimmed)
      else copy[key] = trimmed
    })
    const hidden = entries.length - kept.length
    if (hidden > 0) {
      omitted += hidden
      if (isList) copy.push(remainder(hidden, 'items'))
      else copy['…'] = remainder(hidden, 'keys')
    }
    return copy
  }

  const trimmed = visit(value)
  return { value: trimmed, omitted }
}
