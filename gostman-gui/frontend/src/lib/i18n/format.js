import { ENGLISH, activeLanguage, intlLocale } from './core'

const UNIT_LIST = 'unit'
const ENGLISH_LIST_WORDS = { conjunction: 'and', disjunction: 'or' }
const DATE_OPTIONS = { dateStyle: 'medium' }
const TIME_OPTIONS = { timeStyle: 'medium' }
const DATE_TIME_OPTIONS = { dateStyle: 'medium', timeStyle: 'medium' }
const SEARCH_COLLATION = { sensitivity: 'base', numeric: true }

const cache = new Map()

const hasIntl = (name) => typeof Intl !== 'undefined' && typeof Intl[name] === 'function'

function cached(name, options) {
  if (!hasIntl(name)) return null
  const locale = formattingLocale()
  const key = `${name}|${locale}|${JSON.stringify(options ?? null)}`
  if (!cache.has(key)) {
    try {
      cache.set(key, new Intl[name](locale, options))
    } catch {
      cache.set(key, null)
    }
  }
  return cache.get(key)
}

export function formattingLocale() {
  const language = activeLanguage()
  if (language !== ENGLISH) return intlLocale(language)
  const preferred = typeof navigator !== 'undefined' && Array.isArray(navigator.languages) ? navigator.languages.find((tag) => /^en(-|$)/i.test(tag)) : undefined
  return preferred ?? ENGLISH
}

export function formatNumber(value, options) {
  const formatter = cached('NumberFormat', options)
  return formatter ? formatter.format(value) : String(value)
}

export function formatPercent(ratio, options) {
  const formatter = cached('NumberFormat', { style: 'percent', ...options })
  return formatter ? formatter.format(ratio) : `${Math.round(ratio * 100)}%`
}

function formatMoment(date, options) {
  const moment = date instanceof Date ? date : new Date(date)
  const formatter = cached('DateTimeFormat', options)
  return formatter ? formatter.format(moment) : moment.toISOString()
}

export const formatDate = (date, options = DATE_OPTIONS) => formatMoment(date, options)

export const formatTime = (date, options = TIME_OPTIONS) => formatMoment(date, options)

export const formatDateTime = (date, options = DATE_TIME_OPTIONS) => formatMoment(date, options)

function relativeFallback(value, unit) {
  const amount = Math.abs(value)
  const noun = amount === 1 ? unit : `${unit}s`
  return value < 0 ? `${amount} ${noun} ago` : `in ${amount} ${noun}`
}

export function formatRelativeTime(value, unit) {
  const formatter = cached('RelativeTimeFormat', { numeric: 'auto' })
  return formatter ? formatter.format(value, unit) : relativeFallback(value, unit)
}

function englishList(items, type) {
  if (items.length < 2) return items.join('')
  if (type === UNIT_LIST) return items.join(', ')
  return `${items.slice(0, -1).join(', ')} ${ENGLISH_LIST_WORDS[type]} ${items[items.length - 1]}`
}

export function formatList(items, type = 'conjunction') {
  const formatter = cached('ListFormat', { type, style: 'long' })
  return formatter ? formatter.format(items) : englishList(items, type)
}

const plainCompare = (first, second) => (first < second ? -1 : first > second ? 1 : 0)

export function compareText(first, second) {
  const collator = cached('Collator')
  return collator ? collator.compare(first, second) : plainCompare(first, second)
}

export function searchCollator() {
  return cached('Collator', SEARCH_COLLATION) ?? { compare: (first, second) => plainCompare(first.toLowerCase(), second.toLowerCase()) }
}
