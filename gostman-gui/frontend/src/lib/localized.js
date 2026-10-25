import engineMessages from '../../../../locales/en/engineMessages.json'
import importerMessages from '../../../../locales/en/importerMessages.json'
import lintMessages from '../../../../locales/en/lintMessages.json'
import mockMessages from '../../../../locales/en/mockMessages.json'
import scanMessages from '../../../../locales/en/scanMessages.json'
import { format, hasMessage, registerEnglish } from './i18n/core'
import { formatList } from './i18n/format'

const NAMESPACES = { engineMessages, importerMessages, lintMessages, mockMessages, scanMessages }
const DETAIL_PROBE = '\u0000'
const DETAIL_BREAK = '\n\n'

Object.entries(NAMESPACES).forEach(([namespace, tree]) => registerEnglish(namespace, tree))

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isMessage = (value) => isObject(value) && typeof value.code === 'string'
const isList = (value) => isObject(value) && Array.isArray(value.items)
const isNumeric = (value) => typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))

function splitCode(code) {
  const dot = code.indexOf('.')
  if (dot < 0) return null
  const namespace = code.slice(0, dot)
  const key = code.slice(dot + 1)
  return Object.prototype.hasOwnProperty.call(NAMESPACES, namespace) && hasMessage(namespace, key) ? [namespace, key] : null
}

function paramValue(name, value) {
  if (Array.isArray(value)) return formatList(value.map(String))
  if (isList(value)) return formatList(value.items.map(String), value.type || 'conjunction')
  if (isMessage(value)) return renderMessage(value) ?? value.code
  if (name === 'count' && isNumeric(value)) return Number(value)
  return value
}

function paramsOf(message) {
  return Object.fromEntries(Object.entries(message.params || {}).map(([name, value]) => [name, paramValue(name, value)]))
}

function renderMessage(message) {
  const found = splitCode(message.code)
  if (!found) return undefined
  const [namespace, key] = found
  const params = paramsOf(message)
  if (!message.detail) return format(namespace, key, params)
  const usesDetail = format(namespace, key, { ...params, detail: DETAIL_PROBE }).includes(DETAIL_PROBE)
  const text = format(namespace, key, { ...params, detail: message.detail })
  return usesDetail ? text : `${text}${DETAIL_BREAK}${message.detail}`
}

export function localizedText(localized, english) {
  if (!isMessage(localized)) return english
  return renderMessage(localized) ?? english
}
