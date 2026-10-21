import { Kind, parse, print, visit } from 'graphql'
import { isPlainObject } from './dataUtils'
import {
  defaultSubfield, fieldsOf, isComposite, mustBeProvided, typeNode, typeOf, variableSkeleton,
} from './graphqlModel'

const FRAGMENT_PREFIX = '...'
const NO_VARIABLES = '{}'
const JSON_INDENT = 2

export const fragmentSegment = (typeName) => `${FRAGMENT_PREFIX}${typeName}`

const isFragmentSegment = (segment) => segment.startsWith(FRAGMENT_PREFIX)

const fragmentType = (segment) => segment.slice(FRAGMENT_PREFIX.length)

const nameNode = (value) => ({ kind: Kind.NAME, value })

const variableNode = (name) => ({ kind: Kind.VARIABLE, name: nameNode(name) })

const selectionSetOf = (selections) => ({ kind: Kind.SELECTION_SET, selections })

const capitalized = (text) => text.charAt(0).toUpperCase() + text.slice(1)

export function parseQuery(text) {
  if (text.trim() === '') return { document: { kind: Kind.DOCUMENT, definitions: [] } }
  try {
    return { document: parse(text, { noLocation: true }) }
  } catch (error) {
    return { error }
  }
}

export const firstOperation = (document) => document.definitions.find((definition) => definition.kind === Kind.OPERATION_DEFINITION)

export const fragmentDefinitions = (document) => new Map(
  document.definitions.filter((definition) => definition.kind === Kind.FRAGMENT_DEFINITION).map((definition) => [definition.name.value, definition]),
)

export const argumentNodeOf = (fieldNode, name) => fieldNode.arguments?.find((argument) => argument.name.value === name)

function collectLevel(level, selectionSet, typeName, fragments, isNested, seen) {
  for (const selection of selectionSet?.selections || []) {
    if (selection.kind === Kind.FIELD) {
      if (!level.fields.has(selection.name.value)) level.fields.set(selection.name.value, { node: selection, locked: isNested })
      continue
    }
    const isSpread = selection.kind === Kind.FRAGMENT_SPREAD
    const body = isSpread ? fragments.get(selection.name.value) : selection
    if (!body || (isSpread && seen.has(selection.name.value))) continue
    if (isSpread) seen.add(selection.name.value)
    const condition = body.typeCondition?.name.value
    if (condition && condition !== typeName) {
      level.fragments.set(condition, { node: body, locked: isSpread })
      continue
    }
    collectLevel(level, body.selectionSet, typeName, fragments, true, seen)
  }
}

export function readLevel(selectionSet, typeName, fragments) {
  const level = { fields: new Map(), fragments: new Map() }
  collectLevel(level, selectionSet, typeName, fragments, false, new Set())
  return level
}

const matchesSegment = (selection, segment) => {
  if (isFragmentSegment(segment)) {
    return selection.kind === Kind.INLINE_FRAGMENT && selection.typeCondition?.name.value === fragmentType(segment)
  }
  return selection.kind === Kind.FIELD && selection.name.value === segment
}

const appended = (set, selection) => ({ ...set, selections: [...set.selections, selection] })

const replacedAt = (set, position, selection) => ({
  ...set,
  selections: set.selections.map((current, index) => (index === position ? selection : current)),
})

function changeAt(set, path, change) {
  if (path.length === 0) return change(set)
  const [segment, ...rest] = path
  const position = set.selections.findIndex((selection) => matchesSegment(selection, segment))
  const child = set.selections[position]
  if (!child?.selectionSet) return set
  const inner = changeAt(child.selectionSet, rest, change)
  if (inner === child.selectionSet) return set
  if (inner.selections.length === 0) return { ...set, selections: set.selections.filter((_, index) => index !== position) }
  return replacedAt(set, position, { ...child, selectionSet: inner })
}

const withoutSegment = (segment) => (set) => ({
  ...set,
  selections: set.selections.filter((selection) => !matchesSegment(selection, segment)),
})

function updatedNode(segment, update) {
  return (set) => ({
    ...set,
    selections: set.selections.map((selection) => (matchesSegment(selection, segment) ? update(selection) : selection)),
  })
}

function usedVariables(operation) {
  const names = new Set()
  const collect = { Variable: (node) => { names.add(node.name.value) } }
  visit(operation.selectionSet, collect)
  operation.directives?.forEach((directive) => visit(directive, collect))
  return names
}

function variableName(context, argument, field) {
  const candidates = [argument.name, `${field.name}${capitalized(argument.name)}`]
  const free = candidates.find((candidate) => !context.taken.has(candidate))
  if (free) return free
  let suffix = 2
  while (context.taken.has(`${argument.name}${suffix}`)) suffix += 1
  return `${argument.name}${suffix}`
}

function boundArgument(context, argument, field) {
  const name = variableName(context, argument, field)
  context.taken.add(name)
  context.added.push({
    name,
    value: variableSkeleton(context.index, argument),
    definition: { kind: Kind.VARIABLE_DEFINITION, variable: variableNode(name), type: typeNode(argument.type), directives: [] },
  })
  return { kind: Kind.ARGUMENT, name: nameNode(argument.name), value: variableNode(name) }
}

function newField(context, field, selectionSet) {
  const required = (field.args || []).filter(mustBeProvided)
  return {
    kind: Kind.FIELD,
    name: nameNode(field.name),
    arguments: required.map((argument) => boundArgument(context, argument, field)),
    directives: [],
    ...(selectionSet && { selectionSet }),
  }
}

const plainField = (name) => ({ kind: Kind.FIELD, name: nameNode(name), arguments: [], directives: [] })

const subfieldSelectionSet = (context, type) => selectionSetOf([plainField(defaultSubfield(context.index, type))])

function leafSelectionSet(context, field) {
  const type = typeOf(context.index, field.type)
  return isComposite(type) ? subfieldSelectionSet(context, type) : undefined
}

const newInlineFragment = (typeName, selectionSet) => ({
  kind: Kind.INLINE_FRAGMENT,
  typeCondition: { kind: Kind.NAMED_TYPE, name: nameNode(typeName) },
  directives: [],
  selectionSet,
})

function typeAfter(context, type, segment) {
  if (isFragmentSegment(segment)) return context.index.types.get(fragmentType(segment))
  const field = fieldsOf(type).find((candidate) => candidate.name === segment)
  return field && typeOf(context.index, field.type)
}

function insert(context, set, type, path, leaf) {
  const [segment, ...rest] = path
  const position = set.selections.findIndex((selection) => matchesSegment(selection, segment))
  if (rest.length === 0) return position === -1 ? appended(set, leaf) : set
  const next = typeAfter(context, type, segment)
  if (position !== -1) {
    const child = set.selections[position]
    return replacedAt(set, position, { ...child, selectionSet: insert(context, child.selectionSet, next, rest, leaf) })
  }
  const inner = insert(context, selectionSetOf([]), next, rest, leaf)
  if (isFragmentSegment(segment)) return appended(set, newInlineFragment(fragmentType(segment), inner))
  const field = fieldsOf(type).find((candidate) => candidate.name === segment)
  return appended(set, newField(context, field, inner))
}

function newOperation(root) {
  return { kind: Kind.OPERATION_DEFINITION, operation: root, variableDefinitions: [], directives: [], selectionSet: selectionSetOf([]) }
}

function safeParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function patchVariables(text, set, remove) {
  if (Object.keys(set).length === 0 && remove.length === 0) return text
  const parsed = text.trim() === '' ? {} : safeParse(text)
  if (!isPlainObject(parsed)) return text
  const next = { ...parsed, ...set }
  remove.forEach((name) => { delete next[name] })
  return JSON.stringify(next, null, JSON_INDENT)
}

const printDocument = (document) => (document.definitions.length === 0 ? '' : print(document))

function withOperation(document, operation, existing) {
  const definitions = document.definitions.filter((definition) => definition !== existing)
  if (operation.selectionSet.selections.length === 0) return { ...document, definitions }
  const position = existing ? document.definitions.indexOf(existing) : 0
  return { ...document, definitions: [...definitions.slice(0, position), operation, ...definitions.slice(position)] }
}

function settle(context, operation) {
  const used = usedVariables(operation)
  const orphans = [...context.before].filter((name) => !used.has(name))
  const kept = operation.variableDefinitions.filter((definition) => !orphans.includes(definition.variable.name.value))
  const finished = { ...operation, variableDefinitions: [...kept, ...context.added.map((added) => added.definition)] }
  const set = Object.fromEntries(context.added.map((added) => [added.name, added.value]))
  return {
    query: printDocument(withOperation(context.document, finished, context.existing)),
    variables: patchVariables(context.variables, set, orphans),
  }
}

function edit(state, index, root, change) {
  const parsed = parseQuery(state.query)
  if (parsed.error) return null
  const existing = firstOperation(parsed.document)
  if (existing && existing.operation !== root) return null
  const operation = existing || newOperation(root)
  const context = {
    index,
    existing,
    document: parsed.document,
    variables: state.variables,
    rootType: index.types.get(index.roots[root]),
    before: usedVariables(operation),
    added: [],
    taken: new Set(operation.variableDefinitions.map((definition) => definition.variable.name.value)),
  }
  return settle(context, change(context, operation))
}

const withSelectionSet = (operation, selectionSet) => ({ ...operation, selectionSet })

const removeAt = (path) => (context, operation) => withSelectionSet(
  operation,
  changeAt(operation.selectionSet, path.slice(0, -1), withoutSegment(path.at(-1))),
)

const addAt = (path, makeLeaf) => (context, operation) => withSelectionSet(
  operation,
  insert(context, operation.selectionSet, context.rootType, path, makeLeaf(context)),
)

export const setFieldSelected = (state, index, root, path, field, shouldSelect) => edit(
  state,
  index,
  root,
  shouldSelect ? addAt(path, (context) => newField(context, field, leafSelectionSet(context, field))) : removeAt(path),
)

export const setFragmentSelected = (state, index, root, path, typeName, shouldSelect) => edit(
  state,
  index,
  root,
  shouldSelect
    ? addAt(path, (context) => newInlineFragment(typeName, subfieldSelectionSet(context, context.index.types.get(typeName))))
    : removeAt(path),
)

export function setArgumentIncluded(state, index, root, path, field, argument, shouldInclude) {
  return edit(state, index, root, (context, operation) => {
    const update = (node) => {
      const others = (node.arguments || []).filter((existing) => existing.name.value !== argument.name)
      return { ...node, arguments: shouldInclude ? [...others, boundArgument(context, argument, field)] : others }
    }
    const changed = changeAt(operation.selectionSet, path.slice(0, -1), updatedNode(path.at(-1), update))
    return withSelectionSet(operation, changed)
  })
}
