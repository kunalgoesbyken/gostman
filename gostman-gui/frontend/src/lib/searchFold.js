const COMBINING_MARKS = /\p{M}/gu
const ASCII_LIMIT = 128

const foldUnit = (unit) => {
  if (unit.charCodeAt(0) < ASCII_LIMIT) return unit.toLowerCase()
  return unit.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()
}

export function foldWithOffsets(text) {
  const pieces = []
  const offsets = []
  for (let index = 0; index < text.length; index += 1) {
    const piece = foldUnit(text[index])
    pieces.push(piece)
    for (let at = 0; at < piece.length; at += 1) offsets.push(index)
  }
  return { folded: pieces.join(''), offsets }
}

export const foldText = (text) => foldWithOffsets(text).folded
