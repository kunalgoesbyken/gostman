import { substitutePlaceholders, variableMap } from '../placeholders'

export const SCOPE_ENVIRONMENT = 'environment'
export const SCOPE_SESSION = 'session'
export const SCOPE_COLLECTION = 'collection'
export const SCOPE_GLOBAL = 'global'
export const PROCESS_PREFIX = 'process.env.'

const SCOPES = [SCOPE_ENVIRONMENT, SCOPE_SESSION, SCOPE_COLLECTION, SCOPE_GLOBAL]

const storable = (value) => (value !== null && typeof value === 'object' ? JSON.stringify(value) : value)

const asLayers = (layers) => (Array.isArray(layers) ? layers : []).map((layer) => ({ scope: layer?.scope || '', values: { ...layer?.values } }))

function withEveryScope(layers) {
  const missing = SCOPES.filter((scope) => !layers.some((layer) => layer.scope === scope))
  return [...missing.map((scope) => ({ scope, values: {} })), ...layers]
}

function layeredView(layers) {
  const holder = (name) => [...layers].reverse().find((layer) => Object.hasOwn(layer.values, name))
  const all = () => Object.assign({}, ...layers.map((layer) => layer.values))
  return {
    get: (name) => holder(name)?.values[name],
    has: (name) => holder(name) !== undefined,
    all,
    interpolate: (text) => substitutePlaceholders(String(text), variableMap(all())),
  }
}

export function createScopes(source) {
  const layers = withEveryScope(asLayers(source))
  const writes = Object.fromEntries(SCOPES.map((scope) => [scope, {}]))
  const valuesOf = (scope) => layers.find((layer) => layer.scope === scope).values
  const session = valuesOf(SCOPE_SESSION)
  const layered = layeredView(layers)
  const scopeOf = (scope) => {
    const values = valuesOf(scope)
    const set = (name, value) => {
      values[name] = storable(value)
      writes[scope][name] = values[name]
      if (scope === SCOPE_SESSION) return
      delete session[name]
      delete writes[SCOPE_SESSION][name]
    }
    const unset = (name) => {
      delete values[name]
      writes[scope][name] = null
    }
    return {
      get: (name) => values[name],
      has: (name) => Object.hasOwn(values, name),
      set,
      unset,
      all: () => ({ ...values }),
      clear: () => Object.keys(values).forEach(unset),
      interpolate: layered.interpolate,
    }
  }
  return { ...Object.fromEntries(SCOPES.map((scope) => [scope, scopeOf(scope)])), layered, writes }
}
