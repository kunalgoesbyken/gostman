const PARTS = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/

function parse(version) {
  const match = PARTS.exec(String(version ?? '').trim())
  if (!match) return null
  return { numbers: [match[1], match[2] ?? 0, match[3] ?? 0].map(Number), pre: match[4] ?? '' }
}

function comparePre(first, second) {
  if (first === second) return 0
  if (first === '') return 1
  if (second === '') return -1
  const left = first.split('.')
  const right = second.split('.')
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if (left[index] === undefined) return -1
    if (right[index] === undefined) return 1
    const bothNumeric = /^\d+$/.test(left[index]) && /^\d+$/.test(right[index])
    const order = bothNumeric ? Number(left[index]) - Number(right[index]) : (left[index] < right[index] ? -1 : left[index] > right[index] ? 1 : 0)
    if (order !== 0) return order < 0 ? -1 : 1
  }
  return 0
}

export function compareVersions(first, second) {
  const left = parse(first)
  const right = parse(second)
  if (!left || !right) return 0
  for (let index = 0; index < 3; index += 1) {
    if (left.numbers[index] !== right.numbers[index]) return left.numbers[index] < right.numbers[index] ? -1 : 1
  }
  return comparePre(left.pre, right.pre)
}

export const isValidVersion = (version) => parse(version) !== null

export const isNewerVersion = (candidate, base) => compareVersions(candidate, base) > 0
