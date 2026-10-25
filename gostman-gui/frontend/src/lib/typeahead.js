import { searchCollator } from './i18n/format'

const startsWithText = (label, prefix) => searchCollator().compare(label.slice(0, prefix.length), prefix) === 0

const isShortcutChord = (event) => (event.ctrlKey || event.metaKey || event.altKey) && !event.getModifierState('AltGraph')

export const isTypedCharacter = (event, isTyping) => (
  !isShortcutChord(event) && !event.isComposing && [...event.key].length === 1 && (event.key !== ' ' || isTyping)
)

export function findByPrefix(labels, currentIndex, prefix) {
  const start = currentIndex < 0 ? 0 : currentIndex + ([...prefix].length === 1 ? 1 : 0)
  for (let offset = 0; offset < labels.length; offset += 1) {
    const index = (start + offset) % labels.length
    if (labels[index] !== null && startsWithText(labels[index], prefix)) return index
  }
  return -1
}
