import { documentedCode } from './contract'

const PERCENT_SCALE = 10

const percentOf = (covered, total) => (total === 0 ? 0 : Math.round((covered / total) * 100 * PERCENT_SCALE) / PERCENT_SCALE)

const totals = (covered, total) => ({ total, covered, percent: percentOf(covered, total) })

function operationCoverage(operation, statuses) {
  const codes = Object.keys(operation.responses || {})
  const reached = new Set()
  const undocumented = []
  for (const status of statuses) {
    const code = documentedCode(codes, status)
    if (code === undefined) undocumented.push(status)
    else reached.add(code)
  }
  return {
    key: operation.key,
    method: operation.method,
    path: operation.path,
    covered: statuses.length > 0,
    responses: codes.map((code) => ({ code, covered: reached.has(code) })),
    undocumented,
  }
}

export function contractCoverage(contract, hits) {
  const statusesByKey = new Map()
  for (const { key, status } of hits) {
    if (!statusesByKey.has(key)) statusesByKey.set(key, new Set())
    statusesByKey.get(key).add(status)
  }
  const items = contract.operations.map((operation) => (
    operationCoverage(operation, [...(statusesByKey.get(operation.key) || [])].sort((a, b) => a - b))
  ))
  const responses = items.flatMap((item) => item.responses)
  return {
    operations: totals(items.filter((item) => item.covered).length, items.length),
    responses: totals(responses.filter((response) => response.covered).length, responses.length),
    items,
  }
}

const sumTotals = (list) => totals(
  list.reduce((sum, item) => sum + item.covered, 0),
  list.reduce((sum, item) => sum + item.total, 0),
)

export const mergeCoverage = (coverages) => ({
  operations: sumTotals(coverages.map((coverage) => coverage.operations)),
  responses: sumTotals(coverages.map((coverage) => coverage.responses)),
  items: coverages.flatMap((coverage) => coverage.items),
})
