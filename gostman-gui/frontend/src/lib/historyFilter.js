import { foldCase, matchesTags } from './tags'
import { folderChain } from './variableScopes'
import { inheritedTags } from './collectionTree'

const DAY_MS = 24 * 60 * 60 * 1000

export const RANGE_ANY = 'any'
export const RANGE_TODAY = 'today'
export const RANGE_WEEK = 'week'
export const RANGE_MONTH = 'month'
export const RANGES = [RANGE_ANY, RANGE_TODAY, RANGE_WEEK, RANGE_MONTH]

export const ALL_FOLDERS = ''
export const ALL_TAGS = ''

export const BUCKET_TODAY = 'today'
export const BUCKET_YESTERDAY = 'yesterday'
export const BUCKET_WEEK = 'week'
export const BUCKET_MONTH = 'month'
export const BUCKET_OLDER = 'older'

const RANGE_DAYS = { [RANGE_TODAY]: 1, [RANGE_WEEK]: 7, [RANGE_MONTH]: 30 }

const startOfDay = (time) => {
  const date = new Date(time)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

const daysAgo = (timestamp, now) => Math.round((startOfDay(now) - startOfDay(timestamp)) / DAY_MS)

export function bucketOf(timestamp, now) {
  const days = daysAgo(new Date(timestamp).getTime(), now)
  if (days < 1) return BUCKET_TODAY
  if (days < 2) return BUCKET_YESTERDAY
  if (days < 7) return BUCKET_WEEK
  if (days < 30) return BUCKET_MONTH
  return BUCKET_OLDER
}

const inRange = (entry, range, now) => range === RANGE_ANY || daysAgo(new Date(entry.timestamp).getTime(), now) < RANGE_DAYS[range]

const inFolder = (entry, folderId, folders) => folderId === ALL_FOLDERS || folderChain(folders, entry.folderId).some((folder) => folder.id === folderId)

export function filterHistory(entries, { query, range, folderId, tag }, folders, now) {
  const needle = foldCase(query.trim())
  const tagsOf = inheritedTags(folders)
  const wanted = tag === ALL_TAGS ? [] : [tag]
  return entries.filter((entry) => (
    inRange(entry, range, now)
    && inFolder(entry, folderId, folders)
    && matchesTags(tagsOf(entry), { include: wanted })
    && (needle === '' || foldCase(`${entry.method} ${entry.url} ${entry.statusCode || ''}`).includes(needle))
  ))
}

export function groupByDate(entries, now) {
  const groups = []
  for (const entry of entries) {
    const key = bucketOf(entry.timestamp, now)
    const last = groups.at(-1)
    if (last?.key === key) last.entries.push(entry)
    else groups.push({ key, entries: [entry] })
  }
  return groups
}
