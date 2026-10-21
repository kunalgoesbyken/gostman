import { argumentNodeOf, firstOperation, fragmentDefinitions, fragmentSegment, readLevel } from './graphqlDocument'
import { fieldsOf, isComposite, possibleTypesOf, typeOf } from './graphqlModel'
import { typeText } from './graphqlSchema'

export const ROW_FIELD = 'field'
export const ROW_ARGUMENT = 'argument'
export const ROW_FRAGMENT = 'fragment'

const PATH_SEPARATOR = '/'

export const BUILDER_TEXT = {
  rootLabel: 'Operation type',
  rootNames: { query: 'Query', mutation: 'Mutation', subscription: 'Subscription' },
  title: 'Builder',
  paneLabel: 'Query builder',
  filterLabel: 'Filter fields',
  filterPlaceholder: 'Filter fields',
  expand: 'Expand',
  collapse: 'Collapse',
  select: (name) => `Select ${name}`,
  include: (name) => `Include the argument ${name}`,
  viaFragment: 'Selected through a fragment in the editor. Edit it there.',
  noSchemaTitle: 'No schema loaded',
  noSchemaDescription: "Fetch it to build a query from the endpoint's fields. The introspection query uses this request's URL, headers and auth.",
  fetch: 'Fetch schema',
  refresh: 'Refresh schema',
  loading: 'Fetching the schema',
  syntaxError: (message) => `The builder is paused while the editor has a syntax error: ${message}`,
  subscription: 'Subscriptions stream results over a long-lived connection. Turn on Stream as server-sent events in Settings to read them from servers that deliver subscriptions that way.',
  noRoot: 'This schema has no root type for this operation.',
  empty: 'Nothing matches the filter.',
}

const keyOf = (path) => path.join(PATH_SEPARATOR)

const isOpen = (expansion, key, hasSelection) => expansion.get(key) ?? hasSelection

function argumentRows(found, path, depth) {
  return (found.field.args || []).map((argument) => ({
    kind: ROW_ARGUMENT,
    key: `${keyOf(path)}(${argument.name})`,
    path,
    depth,
    name: argument.name,
    label: typeText(argument.type),
    description: argument.description || '',
    argument,
    field: found.field,
    selected: Boolean(argumentNodeOf(found.node, argument.name)),
    locked: found.locked,
  }))
}

function appendField(context, level, parent, field) {
  const found = level.fields.get(field.name)
  const path = [...parent.path, field.name]
  const target = typeOf(context.index, field.type)
  const composite = isComposite(target)
  const key = keyOf(path)
  const open = composite && isOpen(context.expansion, key, Boolean(found))
  context.rows.push({
    kind: ROW_FIELD,
    key,
    path,
    depth: parent.depth,
    name: field.name,
    label: typeText(field.type),
    description: field.description || '',
    deprecated: Boolean(field.isDeprecated),
    field,
    selected: Boolean(found),
    locked: Boolean(found?.locked),
    composite,
    open,
  })
  if (found) context.rows.push(...argumentRows({ ...found, field }, path, parent.depth + 1))
  if (open) appendLevel(context, { type: target, selectionSet: found?.node.selectionSet, path, depth: parent.depth + 1 })
}

function appendFragment(context, level, parent, typeName) {
  const found = level.fragments.get(typeName)
  const path = [...parent.path, fragmentSegment(typeName)]
  const key = keyOf(path)
  const open = isOpen(context.expansion, key, Boolean(found))
  context.rows.push({
    kind: ROW_FRAGMENT,
    key,
    path,
    depth: parent.depth,
    name: typeName,
    label: '',
    description: '',
    typeName,
    selected: Boolean(found),
    locked: Boolean(found?.locked),
    composite: true,
    open,
  })
  if (open) {
    appendLevel(context, { type: context.index.types.get(typeName), selectionSet: found?.node.selectionSet, path, depth: parent.depth + 1 })
  }
}

function appendLevel(context, parent) {
  if (!parent.type) return
  const level = readLevel(parent.selectionSet, parent.type.name, context.fragments)
  fieldsOf(parent.type).forEach((field) => appendField(context, level, parent, field))
  possibleTypesOf(parent.type).forEach((typeName) => appendFragment(context, level, parent, typeName))
}

export function buildRows(index, root, document, expansion) {
  const operation = document && firstOperation(document)
  const context = {
    index,
    expansion,
    rows: [],
    fragments: document ? fragmentDefinitions(document) : new Map(),
  }
  const selectionSet = operation?.operation === root ? operation.selectionSet : undefined
  appendLevel(context, { type: index.types.get(index.roots[root]), selectionSet, path: [], depth: 0 })
  return context.rows
}

export function filterRows(rows, text) {
  const needle = text.trim().toLocaleLowerCase()
  if (needle === '') return rows
  const kept = new Array(rows.length).fill(false)
  let wanted = -1
  for (let position = rows.length - 1; position >= 0; position -= 1) {
    const row = rows[position]
    kept[position] = row.name.toLocaleLowerCase().includes(needle) || row.depth <= wanted
    if (kept[position]) wanted = row.depth - 1
  }
  return rows.filter((_, position) => kept[position])
}
