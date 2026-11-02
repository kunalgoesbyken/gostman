import { FEATURES } from './featureCatalog'
import { FEATURES_TEXT, FEATURE_WORDS_TEXT } from './featuresText'
import { docsUrl } from './siteLinks'
import { isNewerVersion } from './versions'

const SEARCH_TITLE_START = 30
const SEARCH_TITLE = 20
const SEARCH_SYNONYM_START = 12
const SEARCH_SYNONYM = 8
const SEARCH_OTHER = 3

const camelId = (id) => id.replace(/-([a-z0-9])/g, (match, letter) => letter.toUpperCase())

const wordsOf = (feature) => FEATURE_WORDS_TEXT[camelId(feature.id)]

export const shownFeatures = () => FEATURES.filter((feature) => !feature.hidden)

export const featureById = (id) => FEATURES.find((feature) => feature.id === id) ?? null

export const featureForSurface = (surface) => FEATURES.find((feature) => feature.empty?.includes(surface)) ?? null

export const featureTitle = (feature) => wordsOf(feature).title

export const featureBlurb = (feature) => wordsOf(feature).blurb

export const groupTitle = (group) => FEATURES_TEXT.groups[group]

export const featureKeywords = (feature) => `${wordsOf(feature).synonyms} ${groupTitle(feature.group)} ${featureTitle(feature)}`

export const featureDocsUrl = (feature) => docsUrl(feature.docs ?? '')

export const isDesktopOnly = (feature) => Boolean(feature.platforms) && !feature.platforms.includes('web')

export const isMissingHere = (feature, isDesktop) => isDesktopOnly(feature) && feature.platforms.includes('desktop') && !isDesktop

export const isNewFeature = (feature, seenVersion) => Boolean(feature.since) && seenVersion !== '' && isNewerVersion(feature.since, seenVersion)

function wordScore(feature, word) {
  const title = featureTitle(feature).toLowerCase()
  if (title.startsWith(word)) return SEARCH_TITLE_START
  if (title.includes(word)) return SEARCH_TITLE
  const synonyms = ` ${wordsOf(feature).synonyms.toLowerCase()}`
  if (synonyms.includes(` ${word}`)) return SEARCH_SYNONYM_START
  if (synonyms.includes(word)) return SEARCH_SYNONYM
  const rest = `${featureBlurb(feature)} ${groupTitle(feature.group)} ${feature.id}`.toLowerCase()
  return rest.includes(word) ? SEARCH_OTHER : null
}

function featureScore(feature, words) {
  let total = 0
  for (const word of words) {
    const score = wordScore(feature, word)
    if (score === null) return null
    total += score
  }
  return total
}

export function searchFeatures(query, group = '') {
  const pool = shownFeatures().filter((feature) => !group || feature.group === group)
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return pool
  return pool
    .map((feature) => ({ feature, score: featureScore(feature, words) }))
    .filter((entry) => entry.score !== null)
    .sort((first, second) => second.score - first.score)
    .map((entry) => entry.feature)
}

export function groupsWithCounts() {
  return FEATURES.filter((feature) => !feature.hidden).reduce((counts, feature) => ({ ...counts, [feature.group]: (counts[feature.group] ?? 0) + 1 }), {})
}
