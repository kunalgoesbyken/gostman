import { isMap, isScalar } from 'yaml'
import { LIST_ITEM, REFERENCE_SECTIONS, grammarAt } from './openapiGrammar'
import { parseSpecText } from './specLocate'

const KEY_LINE = /^(\s*)((?:-\s+)*)["']?([^\s"':][^"':]*?)["']?\s*:(?=\s|$)/
const KEY_POSITION = /^(\s*)((?:-\s+)*)(["']?)([^\s"':]*)$/
const VALUE_POSITION = /^(\s*)((?:-\s+)*)["']?([^\s"':]+)["']?:\s+(["']?)([^"']*)$/
const REFERENCE_KEY = '$ref'

function parentPath(lines, column) {
  const path = []
  let limit = column
  for (let index = lines.length - 1; index >= 0 && limit > 0; index -= 1) {
    const match = KEY_LINE.exec(lines[index])
    if (!match) continue
    const [, indent, dashes, key] = match
    const keyColumn = indent.length + dashes.length
    if (keyColumn < limit) {
      path.unshift(key)
      limit = keyColumn
    }
    if (dashes && indent.length < limit) {
      path.unshift(LIST_ITEM)
      limit = indent.length
    }
  }
  return path
}

function contextOf(above, indent, dashes) {
  if (!dashes) return parentPath(above, indent.length)
  return [...parentPath(above, indent.length), LIST_ITEM]
}

const nameOf = (pair) => String(isScalar(pair.key) ? pair.key.value : pair.key)

export function referenceTargets(text) {
  const parsed = parseSpecText(text)
  return REFERENCE_SECTIONS.flatMap((section) => {
    const members = parsed.getIn(['components', section], true)
    return isMap(members) ? members.items.map((pair) => `#/components/${section}/${nameOf(pair)}`) : []
  })
}

const closingQuote = (rest, quote) => (quote !== '' && rest.startsWith(quote) ? 1 : 0)

const referenceApply = (target, quote) => (quote === '' ? `'${target}'` : `${target}${quote}`)

function referenceResult(state, position, quote, typed, rest) {
  return {
    from: position - typed.length,
    to: position + closingQuote(rest, quote),
    options: referenceTargets(state.doc.toString()).map((target) => ({ label: target, type: 'variable', apply: referenceApply(target, quote) })),
  }
}

function valueResult(match, above, position) {
  const [, indent, dashes, key, , typed] = match
  const values = grammarAt(contextOf(above, indent, dashes))?.values?.[key]
  if (!values) return null
  return { from: position - typed.length, options: values.map((value) => ({ label: value, type: 'enum' })) }
}

function keyResult(match, above, position, rest, format) {
  const [, indent, dashes, quote, typed] = match
  const keys = grammarAt(contextOf(above, indent, dashes))?.keys
  if (!keys) return null
  const apply = (key) => {
    if (quote !== '') return `${key}${quote}: `
    return format === 'json' ? `"${key}": ` : `${key}: `
  }
  return {
    from: position - typed.length,
    to: position + closingQuote(rest, quote),
    options: keys.map((key) => ({ label: key, type: 'property', apply: apply(key) })),
  }
}

export const specCompletion = (format) => (context) => {
  const line = context.state.doc.lineAt(context.pos)
  const before = line.text.slice(0, context.pos - line.from)
  const rest = line.text.slice(context.pos - line.from)
  const above = context.state.sliceDoc(0, line.from).split('\n')
  const valueMatch = VALUE_POSITION.exec(before)
  if (valueMatch) {
    const [, , , key, quote, typed] = valueMatch
    if (key === REFERENCE_KEY) return referenceResult(context.state, context.pos, quote, typed, rest)
    return context.explicit || typed !== '' ? valueResult(valueMatch, above, context.pos) : null
  }
  const keyMatch = KEY_POSITION.exec(before)
  if (!keyMatch) return null
  return context.explicit || keyMatch[4] !== '' ? keyResult(keyMatch, above, context.pos, rest, format) : null
}
