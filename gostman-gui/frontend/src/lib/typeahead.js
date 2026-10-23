const collator = new Intl.Collator(undefined, { sensitivity: 'base', usage: 'search' })

const startsWithText = (label, prefix) => collator.compare(label.slice(0, prefix.length), prefix) === 0

const isShortcutChord = (event) => (event.ctrlKey || event.metaKey || event.altKey) && !event.getModifierState('AltGraph')

export const isTypedCharacter = (event, isTyping) => (
  !isShortcutChord(event) && !event.isComposing && [...event.key].length === 1 && (event.key !== ' ' || isTyping)
)

export function findByPrefix(labels, currentIndex, prefix) {
  const startOffset = [...prefix].length === 1 ? 1 : 0
  for (let offset = startOffset; offset < labels.length + startOffset; offset += 1) {
    const index = (currentIndex + offset) % labels.length
    if (labels[index] !== null && startsWithText(labels[index], prefix)) return index
  }
  return -1
}
