import { isPlainObject } from '../dataUtils'
import { AI_TEXT } from '../aiText'

export class ReplyError extends Error {}

function tryParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export function parseModelObject(text) {
  const whole = tryParse(text.trim())
  if (isPlainObject(whole)) return whole
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  const inner = start !== -1 && end > start ? tryParse(text.slice(start, end + 1)) : undefined
  if (!isPlainObject(inner)) throw new ReplyError(AI_TEXT.badReply)
  return inner
}

export const textField = (value, limit) => (typeof value === 'string' ? value.slice(0, limit) : '')

export const listField = (value, limit) => (Array.isArray(value) ? value.slice(0, limit) : [])

export const objectsIn = (value, limit) => listField(value, limit).filter(isPlainObject)

export const stringsIn = (value, limit, length) => listField(value, limit)
  .filter((item) => typeof item === 'string' && item.trim() !== '')
  .map((item) => item.slice(0, length))

export function requireContent(...values) {
  if (values.every((value) => !value || (Array.isArray(value) && value.length === 0))) throw new ReplyError(AI_TEXT.badReply)
}
