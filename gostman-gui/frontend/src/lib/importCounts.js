import { IMPORT_COUNT_TEXT as TEXT } from './importText.js'

const counted = (counts, nouns) => TEXT.list(nouns.filter(([key]) => counts[key] > 0).map(([key, noun]) => TEXT[noun](counts[key])))

function structure(counts) {
  const inside = counted(counts, [['folders', 'folder'], ['requests', 'request']])
  if (!(counts.collections > 0)) return inside || TEXT.request(0)
  const collections = TEXT.collection(counts.collections)
  return inside ? TEXT.holding(collections, inside) : collections
}

export function describeCounts(counts) {
  const values = counted(counts, [['flows', 'flow'], ['environments', 'environment'], ['globals', 'global'], ['variables', 'variable']])
  const settings = counted(counts, [['collectionSettings', 'collection'], ['folderSettings', 'folder']])
  return [structure(counts), values, settings && TEXT.settingsFor(settings)].filter(Boolean).join(TEXT.separator)
}
