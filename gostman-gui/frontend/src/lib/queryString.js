import { isBlankRow, isSentRow, parseRows, serializeRows } from './rows'

const QUERY_MARK = '?'
const FRAGMENT_MARK = '#'
const PAIR_SEPARATOR = '&'
const VALUE_SEPARATOR = '='
const PLACEHOLDER = /(\{\{[^}]+\}\})/

const mapOutsidePlaceholders = (text, transform) => text
  .split(PLACEHOLDER)
  .map((part, index) => (index % 2 === 1 ? part : transform(part)))
  .join('')

const attempt = (convert) => (text) => {
  try {
    return convert(text)
  } catch {
    return text
  }
}

const decodePart = attempt((text) => decodeURIComponent(text.replaceAll('+', ' ')))
const encodePart = attempt(encodeURIComponent)

const decode = (text) => mapOutsidePlaceholders(text, decodePart)
const encode = (text) => mapOutsidePlaceholders(text, encodePart)

const MASKED_PLACEHOLDER = /\{\{[^}]+\}\}/g

const indexOutsidePlaceholders = (text, mark) => (
  text.replace(MASKED_PLACEHOLDER, (placeholder) => ' '.repeat(placeholder.length)).indexOf(mark)
)

function splitUrl(url) {
  const fragmentStart = indexOutsidePlaceholders(url, FRAGMENT_MARK)
  const beforeFragment = fragmentStart === -1 ? url : url.slice(0, fragmentStart)
  const fragment = fragmentStart === -1 ? '' : url.slice(fragmentStart)
  const queryStart = indexOutsidePlaceholders(beforeFragment, QUERY_MARK)
  if (queryStart === -1) return { base: beforeFragment, query: '', fragment }
  return { base: beforeFragment.slice(0, queryStart), query: beforeFragment.slice(queryStart + 1), fragment }
}

function parsePair(pair) {
  const separator = pair.indexOf(VALUE_SEPARATOR)
  const key = separator === -1 ? pair : pair.slice(0, separator)
  const value = separator === -1 ? '' : pair.slice(separator + 1)
  return { key: decode(key), value: decode(value), enabled: true }
}

const parseUrlParams = (url) => splitUrl(url).query
  .split(PAIR_SEPARATOR)
  .filter((pair) => pair !== '')
  .map(parsePair)

function withUrlParams(url, rows) {
  const { base, fragment } = splitUrl(url)
  const query = rows
    .filter((row) => !isBlankRow(row))
    .map((row) => `${encode(row.key)}${VALUE_SEPARATOR}${encode(row.value)}`)
    .join(PAIR_SEPARATOR)
  return base + (query ? QUERY_MARK + query : '') + fragment
}

const byPosition = (first, second) => first.position - second.position

export function readParamRows(url, queryParams) {
  const rows = parseUrlParams(url)
  const disabled = parseRows(queryParams).filter((row) => !row.enabled).sort(byPosition)
  for (const { position, ...row } of disabled) {
    const index = Number.isInteger(position) ? Math.min(position, rows.length) : rows.length
    rows.splice(index, 0, row)
  }
  return rows
}

export function writeParamRows(url, rows) {
  const disabled = rows
    .map((row, position) => ({ ...row, position }))
    .filter((row) => !row.enabled)
  return {
    url: withUrlParams(url, rows.filter((row) => row.enabled)),
    queryParams: serializeRows(disabled),
  }
}

export function foldQueryParams(url, queryParams) {
  const stored = parseRows(queryParams)
  const overrides = stored.filter(isSentRow)
  if (overrides.length === 0) return { url, queryParams }
  const overridden = new Set(overrides.map((row) => row.key))
  const kept = parseUrlParams(url).filter((row) => !overridden.has(row.key))
  const folded = overrides.map(({ key, value }) => ({ key, value, enabled: true }))
  return {
    url: withUrlParams(url, [...kept, ...folded]),
    queryParams: serializeRows(stored.filter((row) => !row.enabled)),
  }
}
