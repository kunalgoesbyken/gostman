export const ENGLISH = 'en'
export const LANGUAGE_MESSAGE = 'language'

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/
const PLACEHOLDER = /\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g
const PSEUDO_BASES = { 'en-XA': 'en', 'ar-XB': 'ar' }

const state = { language: ENGLISH, catalogue: {}, english: {}, cache: new Map(), plural: null, number: null }

const hasIntl = (name) => typeof Intl !== 'undefined' && typeof Intl[name] === 'function'
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const usable = (value) => (typeof value === 'string' && value !== '' ? value : undefined)
const englishCategory = (count) => (count === 1 ? 'one' : 'other')

export const intlLocale = (language) => PSEUDO_BASES[language] ?? language

function intlInstance(name, options) {
  if (!hasIntl(name)) return null
  try {
    return new Intl[name](intlLocale(state.language), options)
  } catch {
    return null
  }
}

function pluralCategory(count) {
  if (state.language === ENGLISH) return englishCategory(count)
  if (state.plural === null) state.plural = intlInstance('PluralRules') ?? { select: englishCategory }
  return state.plural.select(count)
}

function formatCount(count) {
  if (typeof count !== 'number') return String(count)
  if (state.number === null) state.number = intlInstance('NumberFormat') ?? { format: String }
  return state.number.format(count)
}

const lookup = (tree, path) => path.reduce((node, part) => (isPlainObject(node) ? node[part] : undefined), tree)

function pick(tree, path, params, category) {
  const parent = lookup(tree, path.slice(0, -1))
  if (!isPlainObject(parent)) return undefined
  const leaf = path[path.length - 1]
  if (usable(parent[leaf])) return parent[leaf]
  if (!params || params.count === undefined) return undefined
  return usable(parent[`${leaf}_${category(Number(params.count))}`]) ?? usable(parent[`${leaf}_other`])
}

function template(namespace, key, params) {
  const path = key.split('.')
  return pick(state.catalogue[namespace], path, params, pluralCategory) ?? pick(state.english[namespace], path, params, englishCategory)
}

const shownValue = (name, value) => (name === 'count' ? formatCount(value) : String(value))

const filled = (text, params) => text.replace(PLACEHOLDER, (whole, name) => (params && params[name] !== undefined ? shownValue(name, params[name]) : whole))

function filledParts(text, params) {
  const parts = []
  let last = 0
  text.replace(PLACEHOLDER, (whole, name, index) => {
    parts.push(text.slice(last, index))
    parts.push(params && params[name] !== undefined ? (name === 'count' ? formatCount(params[name]) : params[name]) : whole)
    last = index + whole.length
    return whole
  })
  parts.push(text.slice(last))
  return parts.filter((part) => part !== '')
}

export function format(namespace, key, params) {
  const found = template(namespace, key, params)
  return found === undefined ? `${namespace}.${key}` : filled(found, params)
}

export function formatParts(namespace, key, params) {
  const found = template(namespace, key, params)
  return found === undefined ? [`${namespace}.${key}`] : filledParts(found, params)
}

export function hasMessage(namespace, key) {
  const path = key.split('.')
  const leaf = path[path.length - 1]
  return [state.catalogue[namespace], state.english[namespace]].some((tree) => {
    const parent = lookup(tree, path.slice(0, -1))
    return isPlainObject(parent) && (usable(parent[leaf]) !== undefined || usable(parent[`${leaf}_other`]) !== undefined)
  })
}

export function installCatalogue(language, catalogue) {
  state.language = language
  state.catalogue = catalogue || {}
  state.cache.clear()
  state.plural = null
  state.number = null
}

export const activeLanguage = () => state.language

export const catalogueMessage = () => (state.language === ENGLISH ? null : { type: LANGUAGE_MESSAGE, language: state.language, catalogue: state.catalogue })

export function installFromMessage(data) {
  if (!data || data.type !== LANGUAGE_MESSAGE) return false
  installCatalogue(data.language, data.catalogue)
  return true
}

export function registerEnglish(namespace, tree) {
  state.english[namespace] = tree
}

const placeholdersOf = (text) => [...text.matchAll(PLACEHOLDER)].map((match) => match[1])

function leafShapes(tree) {
  const shapes = new Map()
  Object.entries(tree).forEach(([key, value]) => {
    const name = key.replace(PLURAL_SUFFIX, '')
    const shape = shapes.get(name) || { plural: false, names: new Set(), child: null }
    if (isPlainObject(value)) shape.child = value
    else {
      shape.plural = shape.plural || name !== key
      placeholdersOf(value).forEach((placeholder) => shape.names.add(placeholder))
    }
    shapes.set(name, shape)
  })
  return shapes
}

function bindArgument({ plural, names }, argument) {
  if (isPlainObject(argument)) return argument
  if (plural) return { count: argument }
  const [only] = names
  return names.size === 1 ? { [only]: argument } : {}
}

function defineValue(target, name, value) {
  Object.defineProperty(target, name, { value, enumerable: true, configurable: true })
}

function defineGetter(target, name, get) {
  Object.defineProperty(target, name, { get, enumerable: true, configurable: true })
}

function memoisedText(namespace, key) {
  const cacheKey = `${namespace}:${key}`
  return () => {
    if (!state.cache.has(cacheKey)) state.cache.set(cacheKey, format(namespace, key))
    return state.cache.get(cacheKey)
  }
}

function shapeOf(namespace, tree, prefix) {
  const target = {}
  leafShapes(tree).forEach((shape, name) => {
    const key = prefix ? `${prefix}.${name}` : name
    if (shape.child) defineValue(target, name, shapeOf(namespace, shape.child, key))
    else if (shape.plural || shape.names.size > 0) defineValue(target, name, (argument) => format(namespace, key, bindArgument(shape, argument)))
    else defineGetter(target, name, memoisedText(namespace, key))
  })
  return target
}

function overlay(target, extra) {
  Object.entries(Object.getOwnPropertyDescriptors(extra)).forEach(([name, descriptor]) => {
    const current = Object.getOwnPropertyDescriptor(target, name)
    if (isPlainObject(descriptor.value) && current && isPlainObject(current.value)) overlay(current.value, descriptor.value)
    else Object.defineProperty(target, name, { ...descriptor, enumerable: true, configurable: true })
  })
  return target
}

export function messages(namespace, english, adapt) {
  registerEnglish(namespace, english)
  const translate = (key, params) => format(namespace, key, params)
  translate.parts = (key, params) => formatParts(namespace, key, params)
  const shaped = shapeOf(namespace, english, '')
  return adapt ? overlay(shaped, adapt(translate)) : shaped
}
