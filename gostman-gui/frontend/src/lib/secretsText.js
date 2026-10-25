import english from '../../../../locales/en/secrets.json'
import { messages } from './i18n/core'

const WIRE_NAMES = [
  'bitwarden-secrets', 'kv_version', 'role_id', 'secret_id', 'access_key', 'secret_key',
  'session_token', 'tenant_id', 'client_id', 'client_secret', 'session_key',
]

const camelKey = (name) => name.replace(/[-_]([a-z])/g, (whole, letter) => letter.toUpperCase())

const WIRE_BY_KEY = new Map(WIRE_NAMES.map((name) => [camelKey(name), name]))

const isGroup = (value) => value !== null && typeof value === 'object'

function wireTable(t, path, tree) {
  const table = {}
  Object.keys(tree).forEach((key) => {
    const id = `${path}.${key}`
    const name = WIRE_BY_KEY.get(key) ?? key
    if (isGroup(tree[key])) Object.defineProperty(table, name, { value: wireTable(t, id, tree[key]), enumerable: true, configurable: true })
    else Object.defineProperty(table, name, { get: () => t(id), enumerable: true, configurable: true })
  })
  return table
}

const text = messages('secrets', english, (t) => {
  const tableAt = (group, name) => wireTable(t, `${group}.${name}`, english[group][name])

  return {
    secrets: {
      kinds: tableAt('secrets', 'kinds'),
      kindFields: tableAt('secrets', 'kindFields'),
      kindHints: tableAt('secrets', 'kindHints'),
      fields: tableAt('secrets', 'fields'),
      placeholders: tableAt('secrets', 'placeholders'),
    },
    reference: {
      fieldNames: tableAt('reference', 'fieldNames'),
      fieldPlaceholders: tableAt('reference', 'fieldPlaceholders'),
      paths: tableAt('reference', 'paths'),
      versions: tableAt('reference', 'versions'),
    },
  }
})

export const SECRETS_TEXT = text.secrets
export const REFERENCE_TEXT = text.reference
