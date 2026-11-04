const GLYPHS = "{}[]<>/:"

export function cellHash(row, column) {
  let hash = Math.imul(row + 1, 73856093) ^ Math.imul(column + 1, 19349663)
  hash = Math.imul(hash ^ (hash >>> 15), 2246822507)
  return (hash ^ (hash >>> 13)) >>> 0
}

export const glyphAt = (row, column) => GLYPHS[cellHash(row, column) % GLYPHS.length]

export function joinRuns(cells) {
  const runs = []
  for (const cell of cells) {
    const last = runs[runs.length - 1]
    if (last && last.tone === cell.tone) last.text += cell.text
    else runs.push({ ...cell })
  }
  return runs
}
