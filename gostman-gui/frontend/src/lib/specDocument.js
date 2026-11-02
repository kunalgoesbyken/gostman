import { isPlainObject } from './dataUtils'

const SPEC_FORMATS = ['yaml', 'json']
const DEFAULT_SPEC_FORMAT = 'yaml'

const WINDOWS_LINE_BREAK = String.fromCharCode(13, 10)
const LINE_BREAK = String.fromCharCode(10)

const text = (value) => (typeof value === 'string' ? value : '')

const withLineFeeds = (value) => value.replaceAll(WINDOWS_LINE_BREAK, LINE_BREAK)

export function normalizeSpec(raw) {
  const spec = isPlainObject(raw) ? raw : {}
  return {
    id: text(spec.id),
    name: text(spec.name),
    format: SPEC_FORMATS.includes(spec.format) ? spec.format : DEFAULT_SPEC_FORMAT,
    text: withLineFeeds(text(spec.text)),
  }
}

export const newSpec = ({ name, format, text: content }) => normalizeSpec({ id: crypto.randomUUID(), name, format, text: content })

export const copiedSpec = (spec, name) => ({ ...spec, id: crypto.randomUUID(), name })

export const isSpecDirty = (draft, saved) => !saved || draft.name !== saved.name || draft.format !== saved.format || draft.text !== saved.text

export function uniqueSpecName(wanted, specs) {
  const taken = new Set(specs.map((spec) => spec.name.toLocaleLowerCase()))
  if (!taken.has(wanted.toLocaleLowerCase())) return wanted
  let number = 2
  while (taken.has(`${wanted} ${number}`.toLocaleLowerCase())) number += 1
  return `${wanted} ${number}`
}

const JSON_START = new Set(['{', '['])

export const detectSpecFormat = (text) => (JSON_START.has(text.trimStart()[0]) ? 'json' : DEFAULT_SPEC_FORMAT)

export const specSource = (spec) => ({ text: spec.text })

export function stemOfFileName(fileName) {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}
