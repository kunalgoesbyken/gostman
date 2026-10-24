import { isPlainObject, lookup } from './dataUtils.js'
import { automaticSwatch, cleanColorChoice } from './swatches.js'
import { foldCase } from './tags.js'

const MAX_TAG_LENGTH = 100

export const tagKey = (tag) => foldCase(tag.trim())

export function normalizeTagColors(raw) {
  const source = isPlainObject(raw) ? raw : {}
  const entries = Object.entries(source).map(([tag, color]) => [tagKey(tag), cleanColorChoice(color)])
  return Object.fromEntries(entries.filter(([tag, color]) => tag !== '' && tag.length <= MAX_TAG_LENGTH && color !== ''))
}

export const chosenTagColor = (tagColors, tag) => lookup(tagColors, tagKey(tag)) ?? ''

export const tagColor = (tagColors, tag) => chosenTagColor(tagColors, tag) || automaticSwatch(tagKey(tag))

export function withTagColor(tagColors, tag, color) {
  const key = tagKey(tag)
  const others = Object.entries(tagColors).filter(([existing]) => existing !== key)
  return Object.fromEntries(color ? [...others, [key, color]] : others)
}
