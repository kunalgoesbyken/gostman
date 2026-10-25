import { substitutePlaceholders, variableMap } from '../placeholders'

export const SCOPE_ENVIRONMENT = 'environment'
export const SCOPE_SESSION = 'session'
export const SCOPE_COLLECTION = 'collection'
export const SCOPE_GLOBAL = 'global'
export const PROCESS_PREFIX = 'process.env.'

const SCOPES = [SCOPE_ENVIRONMENT, SCOPE_SESSION, SCOPE_COLLECTION, SCOPE_GLOBAL]

const storable = (value) => (value !== null && typeof value === 'object' ? JSON.stringify(value) : value)

export function createScopes(variables) {
  const writes = Object.fromEntries(SCOPES.map((scope) => [scope, {}]))
  const interpolate = (text) => substitutePlaceholders(String(text), variableMap(variables))
  const scopeOf = (scope) => {
    const set = (name, value) => {
      variables[name] = storable(value)
      writes[scope][name] = variables[name]
    }
    const unset = (name) => {
      delete variables[name]
      writes[scope][name] = null
    }
    return {
      get: (name) => variables[name],
      has: (name) => Object.hasOwn(variables, name),
      set,
      unset,
      all: () => ({ ...variables }),
      clear: () => Object.keys(variables).forEach(unset),
      interpolate,
    }
  }
  return { ...Object.fromEntries(SCOPES.map((scope) => [scope, scopeOf(scope)])), writes }
}
