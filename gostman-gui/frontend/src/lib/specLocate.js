import { isMap, isScalar, isSeq, parseDocument } from 'yaml'

const keyName = (pair) => String(isScalar(pair.key) ? pair.key.value : pair.key)

export const parseSpecText = (text) => parseDocument(text)

export const pointerSegments = (pointer) => pointer.split('/').slice(1).map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))

function child(node, segment) {
  if (isMap(node)) {
    const pair = node.items.find((candidate) => keyName(candidate) === segment)
    return pair?.key?.range && { node: pair.value, offset: pair.key.range[0] }
  }
  if (isSeq(node)) {
    const item = node.items[Number(segment)]
    return item?.range && { node: item, offset: item.range[0] }
  }
  return undefined
}

export function locate(parsed, segments) {
  let node = parsed.contents
  let offset = 0
  let depth = 0
  for (const segment of segments) {
    const next = child(node, segment)
    if (!next) break
    node = next.node
    offset = next.offset
    depth += 1
  }
  return { offset, isExact: depth === segments.length }
}

function locateFirst(parsed, candidates) {
  const found = candidates.map((segments) => locate(parsed, segments))
  return found.find((place) => place.isExact) ?? found[0]
}

const MODEL_SECTIONS = [['components', 'schemas'], ['definitions']]

const targetSegments = (target) => (
  target.kind === 'operation'
    ? [['paths', target.path, target.method.toLowerCase()]]
    : MODEL_SECTIONS.map((section) => [...section, target.name])
)

export const targetOffset = (text, target) => locateFirst(parseSpecText(text), targetSegments(target)).offset
