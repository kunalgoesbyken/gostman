import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'

export const ENGLISH = 'en'
export const LANGUAGE_DIRECTORY = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2}|-[0-9]{3})?$/
export const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/
const SEGMENT = /^[a-z][A-Za-z0-9]*$/
const PLACEHOLDER = /\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g
const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype']
const COUNT = 'count'
const PLAIN = 'plain'

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const placeholdersOf = (text) => new Set([...text.matchAll(PLACEHOLDER)].map((match) => match[1]))

const hasStrayBraces = (text) => /\{\{|\}\}/.test(text.replace(PLACEHOLDER, ''))

const joinPath = (prefix, name) => (prefix ? `${prefix}.${name}` : name)

export function languageDirectories(localesRoot) {
  if (!existsSync(localesRoot)) return []
  return readdirSync(localesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && LANGUAGE_DIRECTORY.test(entry.name))
    .map((entry) => entry.name)
}

export const namespaceFiles = (directory) =>
  existsSync(directory) ? readdirSync(directory).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5)).sort() : []

export function readCatalogue(localesRoot, language) {
  const directory = join(localesRoot, language)
  return Object.fromEntries(namespaceFiles(directory).map((namespace) => [namespace, JSON.parse(readFileSync(join(directory, `${namespace}.json`), 'utf8'))]))
}

function checkKey(key, value, where, errors) {
  const name = isObject(value) ? key : key.replace(PLURAL_SUFFIX, '')
  if (FORBIDDEN_KEYS.includes(key)) errors.push(`${where}: the key "${key}" is not allowed.`)
  else if (!SEGMENT.test(name)) errors.push(`${where}: the key "${key}" must match ${SEGMENT}, with a plural suffix only on messages.`)
}

function checkTree(tree, where, errors) {
  if (!isObject(tree)) {
    errors.push(`${where}: the file must hold a JSON object.`)
    return
  }
  Object.entries(tree).forEach(([key, value]) => {
    checkKey(key, value, where, errors)
    if (isObject(value)) checkTree(value, `${where}.${key}`, errors)
    else if (typeof value !== 'string') errors.push(`${where}.${key}: a value must be a string or an object.`)
    else if (hasStrayBraces(value)) errors.push(`${where}.${key}: malformed placeholder, write {{name}} with letters and digits only.`)
  })
}

function addMessage(messages, prefix, key, text, where, errors) {
  const category = key.match(PLURAL_SUFFIX)?.[1]
  const id = joinPath(prefix, category ? key.replace(PLURAL_SUFFIX, '') : key)
  const entry = messages.get(id) ?? { plural: category !== undefined, forms: new Map() }
  if (entry.group || entry.plural !== (category !== undefined)) {
    errors.push(`${where}: ${id} is used both as a plain message and as a plural group, or as a group.`)
    return
  }
  entry.forms.set(category ?? PLAIN, text)
  messages.set(id, entry)
}

function collectMessages(tree, prefix, messages, where, errors) {
  Object.entries(tree).forEach(([key, value]) => {
    if (isObject(value)) {
      const id = joinPath(prefix, key)
      if (messages.has(id)) errors.push(`${where}: ${id} is used both as a message and as a group.`)
      messages.set(id, { group: true })
      collectMessages(value, id, messages, where, errors)
    } else if (typeof value === 'string') addMessage(messages, prefix, key, value, where, errors)
  })
}

function messageMap(tree, where, errors) {
  const messages = new Map()
  if (isObject(tree)) collectMessages(tree, '', messages, where, errors)
  return messages
}

const leafMessages = (messages) => [...messages].filter(([, entry]) => !entry.group)

const placeholdersOfMessage = (entry) => new Set([...entry.forms.values()].flatMap((text) => [...placeholdersOf(text)]))

const isTranslated = (entry) => (entry.plural ? entry.forms.get('other') : entry.forms.get(PLAIN)) !== undefined && [...entry.forms.values()].some((text) => text !== '')

function checkEnglishPlurals(messages, where, errors) {
  leafMessages(messages).forEach(([id, entry]) => {
    if (!entry.plural) return
    ;['one', 'other'].forEach((category) => {
      if (!entry.forms.has(category)) errors.push(`${where}: ${id} is a plural group and needs _${category}.`)
    })
  })
}

function pluralCategories(language) {
  try {
    return new Intl.PluralRules(language).resolvedOptions().pluralCategories
  } catch {
    return null
  }
}

function checkPlaceholders(id, entry, english, where, errors) {
  const allowed = placeholdersOfMessage(english)
  const required = [...allowed].filter((name) => !(entry.plural && name === COUNT))
  entry.forms.forEach((text, category) => {
    if (text === '') return
    const used = placeholdersOf(text)
    const label = `${where}: ${id}${category === PLAIN ? '' : `_${category}`}`
    used.forEach((name) => {
      if (!allowed.has(name)) errors.push(`${label} uses {{${name}}}, which the English message does not have.`)
    })
    required.forEach((name) => {
      if (!used.has(name)) errors.push(`${label} is missing {{${name}}}.`)
    })
  })
}

function checkPluralForms(id, entry, language, where, errors, warnings) {
  const categories = pluralCategories(language)
  entry.forms.forEach((_text, category) => {
    if (categories && !categories.includes(category)) errors.push(`${where}: ${id}_${category} is not a plural form of ${language} (${categories.join(', ')}).`)
  })
  if (!entry.forms.has('other')) {
    errors.push(`${where}: ${id} is a plural group and needs _other.`)
    return
  }
  const missing = (categories ?? []).filter((category) => !entry.forms.get(category))
  if (missing.length > 0) warnings.push(`${where}: ${id} has no ${missing.join(', ')} form, so _other is used.`)
}

function checkTranslation(id, entry, english, language, where, errors, warnings) {
  if (!english || english.group) {
    errors.push(`${where}: ${id} does not exist in English.`)
    return
  }
  if (entry.plural !== english.plural) {
    errors.push(`${where}: ${id} is ${entry.plural ? 'a plural group' : 'a plain message'} here but ${english.plural ? 'a plural group' : 'a plain message'} in English.`)
    return
  }
  if (entry.plural) checkPluralForms(id, entry, language, where, errors, warnings)
  checkPlaceholders(id, entry, english, where, errors)
}

function checkNotes(localesRoot, englishMessages, errors) {
  const directory = join(localesRoot, '_notes')
  namespaceFiles(directory).forEach((namespace) => {
    const where = `_notes/${namespace}.json`
    let notes
    try {
      notes = JSON.parse(readFileSync(join(directory, `${namespace}.json`), 'utf8'))
    } catch (error) {
      errors.push(`${where}: ${error.message}`)
      return
    }
    if (!englishMessages[namespace]) {
      errors.push(`${where}: there is no English file for this namespace.`)
      return
    }
    Object.entries(notes).forEach(([key, note]) => {
      if (typeof note !== 'string' || note.trim() === '') errors.push(`${where}: the note for ${key} must be a non-empty string.`)
      if (!englishMessages[namespace].has(key)) errors.push(`${where}: ${key} does not exist in English.`)
    })
  })
}

function loadFile(localesRoot, language, namespace, errors) {
  const where = `${language}/${namespace}.json`
  try {
    const tree = JSON.parse(readFileSync(join(localesRoot, language, `${namespace}.json`), 'utf8'))
    checkTree(tree, where, errors)
    return tree
  } catch (error) {
    errors.push(`${where}: ${error.message}`)
    return null
  }
}

function validateLanguage(localesRoot, language, englishMessages, errors, warnings) {
  let translated = 0
  let missing = 0
  const present = new Set(namespaceFiles(join(localesRoot, language)))
  present.forEach((namespace) => {
    if (!englishMessages[namespace]) errors.push(`${language}/${namespace}.json: there is no English file for this namespace.`)
  })
  Object.entries(englishMessages).forEach(([namespace, english]) => {
    const where = `${language}/${namespace}.json`
    const tree = present.has(namespace) ? loadFile(localesRoot, language, namespace, errors) : {}
    const messages = messageMap(tree, where, errors)
    messages.forEach((entry, id) => {
      if (!entry.group) checkTranslation(id, entry, english.get(id), language, where, errors, warnings)
    })
    leafMessages(english).forEach(([id]) => {
      const entry = messages.get(id)
      if (entry && !entry.group && isTranslated(entry)) translated += 1
      else missing += 1
    })
  })
  return { translated, missing }
}

export function validateCatalogues(localesRoot) {
  const errors = []
  const warnings = []
  const coverage = {}
  const fallbacks = {}
  const englishMessages = {}
  namespaceFiles(join(localesRoot, ENGLISH)).forEach((namespace) => {
    const where = `${ENGLISH}/${namespace}.json`
    englishMessages[namespace] = messageMap(loadFile(localesRoot, ENGLISH, namespace, errors), where, errors)
    checkEnglishPlurals(englishMessages[namespace], where, errors)
  })
  const total = Object.values(englishMessages).reduce((sum, messages) => sum + leafMessages(messages).length, 0)
  checkNotes(localesRoot, englishMessages, errors)
  languageDirectories(localesRoot)
    .filter((language) => language !== ENGLISH)
    .forEach((language) => {
      const { translated, missing } = validateLanguage(localesRoot, language, englishMessages, errors, warnings)
      coverage[language] = total === 0 ? 0 : translated / total
      fallbacks[language] = missing
    })
  return { errors, warnings, coverage, fallbacks, counts: { messages: total, namespaces: Object.keys(englishMessages).length } }
}

const withThousands = (value) => value.toLocaleString('en-US')

export function fallbackSummary({ fallbacks, counts }) {
  return Object.entries(fallbacks)
    .filter(([, missing]) => missing > 0)
    .map(([language, missing]) => `${language}: ${withThousands(missing)} of ${withThousands(counts.messages)} messages fall back to English`)
}
