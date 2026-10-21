import { getIntrospectionQuery } from 'graphql'
import { isPlainObject } from './dataUtils'
import { parseJsonBody, textBody } from './response'

export const GRAPHQL_METHOD = 'GRAPHQL'

export const KIND_NON_NULL = 'NON_NULL'
export const KIND_LIST = 'LIST'
const RESERVED_PREFIX = '__'
const UNKNOWN_TYPE = '?'
export const ROOT_FIELDS = [
  ['queryType', 'query'],
  ['mutationType', 'mutation'],
  ['subscriptionType', 'subscription'],
]

export const introspectionRequest = (request) => ({
  ...request,
  method: GRAPHQL_METHOD,
  graphqlQuery: getIntrospectionQuery(),
  graphqlVariables: '',
})

export function typeText(reference) {
  if (!reference) return UNKNOWN_TYPE
  if (reference.kind === KIND_NON_NULL) return `${typeText(reference.ofType)}!`
  if (reference.kind === KIND_LIST) return `[${typeText(reference.ofType)}]`
  return reference.name || UNKNOWN_TYPE
}

const typedName = ({ name, type }) => `${name}: ${typeText(type)}`

function fieldSignature(field) {
  const args = field.args || []
  const argumentList = args.length > 0 ? `(${args.map(typedName).join(', ')})` : ''
  return `${field.name}${argumentList}: ${typeText(field.type)}`
}

const toMember = (signature) => (item) => ({
  name: item.name,
  signature: signature(item),
  description: item.description || '',
})

const membersOf = (type) => [
  ...(type.fields || []).map(toMember(fieldSignature)),
  ...(type.inputFields || []).map(toMember(typedName)),
  ...(type.enumValues || []).map(toMember((value) => value.name)),
  ...(type.possibleTypes || []).map(toMember((possible) => possible.name)),
]

function rootLabels(schema) {
  const named = ROOT_FIELDS.filter(([field]) => schema[field]?.name)
  return new Map(named.map(([field, label]) => [schema[field].name, label]))
}

function summarize(schema) {
  const roots = rootLabels(schema)
  const rootOrder = [...roots.keys()]
  const rank = (type) => (roots.has(type.name) ? rootOrder.indexOf(type.name) : rootOrder.length)
  return (schema.types || [])
    .filter((type) => type?.name && !type.name.startsWith(RESERVED_PREFIX))
    .map((type) => ({
      name: type.name,
      label: roots.get(type.name) || String(type.kind || '').toLowerCase().replaceAll('_', ' '),
      description: type.description || '',
      members: membersOf(type),
    }))
    .sort((first, second) => rank(first) - rank(second) || first.name.localeCompare(second.name))
}

function unreadableBody(response) {
  if (response.truncated) return 'The schema is larger than the response size limit.'
  return `The endpoint answered ${response.status} without a JSON body.`
}

export function readSchema(response) {
  if (response.error) return { error: response.body }
  const payload = parseJsonBody(textBody(response))
  if (!isPlainObject(payload)) return { error: unreadableBody(response) }
  const schema = payload.data?.__schema
  if (!isPlainObject(schema)) {
    return { error: payload.errors?.[0]?.message || `The endpoint answered ${response.status} without a schema.` }
  }
  return { types: summarize(schema), introspection: schema }
}
