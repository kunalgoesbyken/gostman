import { statusClassOf } from './callHistory'
import { mergeCalls } from './journalMerge'
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
export const ALL_STATUSES = ''

export const BUCKET_TODAY = 'today'
export const BUCKET_YESTERDAY = 'yesterday'
export const BUCKET_WEEK = 'week'
export const BUCKET_MONTH = 'month'
export const BUCKET_OLDER = 'older'

const RANGE_DAYS = { [RANGE_TODAY]: 1, [RANGE_WEEK]: 7, [RANGE_MONTH]: 30 }
const RELATIVE_DAYS = { 0: BUCKET_TODAY, 1: BUCKET_YESTERDAY }

const startOfDay = (time) => {
  const date = new Date(time)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

const startOfNextDay = (day) => {
  const date = new Date(day)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
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

const inRange = (timestamp, range, now) => range === RANGE_ANY || daysAgo(new Date(timestamp).getTime(), now) < RANGE_DAYS[range]

const inFolder = (entry, folderId, folders) => folderId === ALL_FOLDERS || folderChain(folders, entry.folderId).some((folder) => folder.id === folderId)

function matchersOf({ query, range, folderId, tag, statusClass = ALL_STATUSES }, folders, now) {
  const needle = foldCase(query.trim())
  const tagsOf = inheritedTags(folders)
  const wanted = tag === ALL_TAGS ? [] : [tag]
  const keepsTime = (timestamp) => inRange(timestamp, range, now)
  const keepsOutcome = (entry, { statusCode, noResponse }) => (
    (statusClass === ALL_STATUSES || statusClassOf({ statusCode, noResponse }) === statusClass)
    && (needle === '' || foldCase(`${entry.method} ${entry.url} ${statusCode || ''}`).includes(needle))
  )
  return {
    keepsEntry: (entry) => inFolder(entry, folderId, folders) && matchesTags(tagsOf(entry), { include: wanted }),
    keepsTime,
    keepsOutcome,
    keepsSend: (entry, timestamp, outcome) => keepsTime(timestamp) && keepsOutcome(entry, outcome),
  }
}

export function filterHistory(entries, filters, folders, now) {
  const { keepsEntry, keepsSend } = matchersOf(filters, folders, now)
  return entries.filter((entry) => keepsEntry(entry) && keepsSend(entry, entry.timestamp, entry))
}

export function journalView(entries, filters, folders, now) {
  const { keepsEntry, keepsTime, keepsOutcome } = matchersOf(filters, folders, now)
  const merged = mergeCalls(entries.filter(keepsEntry), keepsTime, keepsOutcome)
  return {
    count: merged.count,
    rows: merged.rows,
    days: (limit) => {
      const groups = groupByDay(merged.rows(limit), now)
      const last = groups.at(-1)
      return groups.map((group) => ({ ...group, count: group === last ? merged.countCalls(group.day, startOfNextDay(group.day)) : group.rows.length }))
    },
  }
}

export const journalOf = (entries, filters, folders, now) => journalView(entries, filters, folders, now).rows(Infinity)

export function groupByDay(rows, now) {
  const groups = []
  for (const row of rows) {
    const time = new Date(row.timestamp).getTime()
    const day = startOfDay(time)
    const last = groups.at(-1)
    if (last?.day === day) last.rows.push(row)
    else groups.push({ day, relative: RELATIVE_DAYS[daysAgo(time, now)] ?? '', rows: [row] })
  }
  return groups
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
