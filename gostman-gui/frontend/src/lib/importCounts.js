import { pluralize } from './dataUtils.js'
import { IMPORT_COUNT_TEXT as TEXT } from './importText.js'

const counted = (counts, nouns) => TEXT.list(nouns.filter(([key]) => counts[key] > 0).map(([key, noun]) => pluralize(counts[key], noun)))

function structure(counts) {
  const inside = counted(counts, [['folders', TEXT.folder], ['requests', TEXT.request]])
  if (!(counts.collections > 0)) return inside || pluralize(0, TEXT.request)
  const collections = pluralize(counts.collections, TEXT.collection)
  return inside ? TEXT.holding(collections, inside) : collections
}

export function describeCounts(counts) {
  const values = counted(counts, [['environments', TEXT.environment], ['globals', TEXT.global], ['variables', TEXT.variable]])
  const settings = counted(counts, [['collectionSettings', TEXT.collection], ['folderSettings', TEXT.folder]])
  return [structure(counts), values, settings && TEXT.settingsFor(settings)].filter(Boolean).join(TEXT.separator)
}
