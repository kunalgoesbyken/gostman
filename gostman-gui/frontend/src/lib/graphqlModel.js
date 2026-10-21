import { Kind, parseValue, valueFromASTUntyped } from 'graphql'
import { KIND_LIST, KIND_NON_NULL, ROOT_FIELDS } from './graphqlSchema'

const KIND_OBJECT = 'OBJECT'
const KIND_INTERFACE = 'INTERFACE'
const KIND_UNION = 'UNION'
const KIND_ENUM = 'ENUM'
const KIND_INPUT_OBJECT = 'INPUT_OBJECT'

const TYPENAME = '__typename'
const TYPENAME_FIELD = { name: TYPENAME, args: [], type: { kind: 'SCALAR', name: 'String' }, isDeprecated: false }
const COMPOSITE_KINDS = [KIND_OBJECT, KIND_INTERFACE, KIND_UNION]
const SCALAR_DEFAULTS = { Int: 0, Float: 0, Boolean: false, String: '', ID: '' }
const PREFERRED_SUBFIELD = 'id'
const SKELETON_DEPTH_LIMIT = 6

export function buildIndex(introspection) {
  const types = new Map((introspection.types || []).filter((type) => type?.name).map((type) => [type.name, type]))
  const roots = Object.fromEntries(ROOT_FIELDS.map(([field, root]) => [root, introspection[field]?.name || '']))
  return { types, roots }
}

function namedType(reference) {
  let current = reference
  while (current?.ofType) current = current.ofType
  return current
}

const isRequired = (reference) => reference.kind === KIND_NON_NULL

export const typeOf = (index, reference) => index.types.get(namedType(reference)?.name)

export const isComposite = (type) => COMPOSITE_KINDS.includes(type?.kind)

export const fieldsOf = (type) => (isComposite(type) ? [...(type.fields || []), TYPENAME_FIELD] : [])

export const possibleTypesOf = (type) => (
  type?.kind === KIND_OBJECT ? [] : (type?.possibleTypes || []).map((possible) => possible.name)
)

export const mustBeProvided = (argument) => isRequired(argument.type) && !argument.defaultValue

export function typeNode(reference) {
  if (reference.kind === KIND_NON_NULL) return { kind: Kind.NON_NULL_TYPE, type: typeNode(reference.ofType) }
  if (reference.kind === KIND_LIST) return { kind: Kind.LIST_TYPE, type: typeNode(reference.ofType) }
  return { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: reference.name } }
}

function inputObjectSkeleton(index, type, depth) {
  const required = (type.inputFields || []).filter((field) => isRequired(field.type))
  return Object.fromEntries(required.map((field) => [field.name, skeleton(index, field.type, depth + 1)]))
}

function skeleton(index, reference, depth) {
  if (reference.kind === KIND_NON_NULL) return skeleton(index, reference.ofType, depth)
  if (reference.kind === KIND_LIST) return [skeleton(index, reference.ofType, depth)]
  const type = index.types.get(reference.name)
  if (type?.kind === KIND_ENUM) return type.enumValues?.[0]?.name ?? ''
  if (type?.kind === KIND_INPUT_OBJECT) return depth < SKELETON_DEPTH_LIMIT ? inputObjectSkeleton(index, type, depth) : {}
  return SCALAR_DEFAULTS[reference.name] ?? ''
}

function declaredDefault(argument) {
  try {
    return valueFromASTUntyped(parseValue(argument.defaultValue))
  } catch {
    return undefined
  }
}

export function variableSkeleton(index, argument) {
  if (argument.defaultValue) {
    const declared = declaredDefault(argument)
    if (declared !== undefined) return declared
  }
  return skeleton(index, argument.type, 0)
}

const isLeaf = (index, field) => !isComposite(typeOf(index, field.type))

const needsNothing = (field) => (field.args || []).every((argument) => !mustBeProvided(argument))

export function defaultSubfield(index, type) {
  const candidates = (type?.fields || []).filter((field) => isLeaf(index, field) && needsNothing(field))
  return candidates.find((field) => field.name === PREFERRED_SUBFIELD)?.name || candidates[0]?.name || TYPENAME
}
