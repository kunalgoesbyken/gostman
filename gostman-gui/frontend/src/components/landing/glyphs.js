const GLYPHS = "{}[]<>/:"

export const GLYPH_TONES = ["text-primary", "text-success", "text-info", "text-warning", "text-foreground"]

export function cellHash(row, column) {
  let hash = Math.imul(row + 1, 73856093) ^ Math.imul(column + 1, 19349663)
  hash = Math.imul(hash ^ (hash >>> 15), 2246822507)
  return (hash ^ (hash >>> 13)) >>> 0
}

export const glyphAt = (row, column) => GLYPHS[cellHash(row, column) % GLYPHS.length]

export const toneAt = (row, column) => GLYPH_TONES[cellHash(column, row) % GLYPH_TONES.length]

export function joinRuns(cells) {
  const runs = []
  for (const cell of cells) {
    const last = runs[runs.length - 1]
    if (last && last.tone === cell.tone) last.text += cell.text
    else runs.push({ ...cell })
  }
  return runs
}
