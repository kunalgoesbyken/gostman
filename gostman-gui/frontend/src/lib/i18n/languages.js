import { LANGUAGE_LIST, LOCALE_LOADERS } from 'virtual:gostman-languages'
import { ENGLISH } from './core'

export const SYSTEM_LANGUAGE = 'system'
export const RTL_LANGUAGES = ['ar', 'fa', 'he', 'ur', 'ps', 'sd', 'ug', 'yi', 'ckb', 'dv']

const PSEUDO_NAMES = { 'en-XA': 'Pseudo, accented (en-XA)', 'ar-XB': 'Pseudo, right to left (ar-XB)' }

export const baseLanguage = (language) => language.split('-')[0].toLowerCase()

export const directionOf = (language) => (RTL_LANGUAGES.includes(baseLanguage(language)) ? 'rtl' : 'ltr')

export function languageName(language) {
  if (PSEUDO_NAMES[language]) return PSEUDO_NAMES[language]
  if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') return language
  try {
    const name = new Intl.DisplayNames([language], { type: 'language' }).of(language)
    return name ? name.charAt(0).toLocaleUpperCase(language) + name.slice(1) : language
  } catch {
    return language
  }
}

const byName = (first, second) => languageName(first.value).localeCompare(languageName(second.value))

const entry = ({ value, pseudo }) => ({ value, direction: directionOf(value), pseudo })

const listed = (pseudo) => LANGUAGE_LIST.filter((language) => language.value !== ENGLISH && language.pseudo === pseudo).map(entry).sort(byName)

export const LANGUAGES = [
  ...LANGUAGE_LIST.filter((language) => language.value === ENGLISH).map(entry),
  ...listed(false),
  ...listed(true),
]

export const LANGUAGE_VALUES = [SYSTEM_LANGUAGE, ...LANGUAGES.map((language) => language.value)]

const realLanguages = () => LANGUAGES.filter((language) => !language.pseudo).map((language) => language.value)

function scriptKey(tag) {
  if (typeof Intl === 'undefined' || typeof Intl.Locale !== 'function') return null
  try {
    const { language, script } = new Intl.Locale(tag).maximize()
    return `${language}-${script}`
  } catch {
    return null
  }
}

const sameCase = (first, second) => first.toLowerCase() === second.toLowerCase()

function exactMatch(available, wanted) {
  for (const tag of wanted) {
    const found = available.find((language) => sameCase(language, tag))
    if (found) return found
  }
  return null
}

function scriptMatch(available, wanted) {
  for (const tag of wanted) {
    const key = scriptKey(tag)
    const found = key === null ? undefined : available.find((language) => scriptKey(language) === key)
    if (found) return found
  }
  return null
}

export function resolveLanguage(preference, wanted = typeof navigator === 'undefined' ? [] : navigator.languages ?? []) {
  if (preference !== SYSTEM_LANGUAGE) return LANGUAGE_VALUES.includes(preference) ? preference : ENGLISH
  const available = realLanguages()
  return exactMatch(available, wanted) ?? scriptMatch(available, wanted) ?? ENGLISH
}

export const loadCatalogue = (language) => LOCALE_LOADERS[language]().then((module) => module.default)
