import { isPlainObject } from '../dataUtils'

const textOf = (value) => (typeof value === 'string' ? value : '')

export function readSavedMessages(json) {
  let parsed
  try {
    parsed = JSON.parse(json || '[]')
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter((entry) => isPlainObject(entry) && textOf(entry.name).trim())
    .map((entry) => ({ name: entry.name.trim(), body: textOf(entry.body), target: textOf(entry.target) }))
}

const write = (messages) => (messages.length === 0 ? '' : JSON.stringify(messages))

export function saveMessage(json, message) {
  const others = readSavedMessages(json).filter((entry) => entry.name !== message.name)
  return write([...others, message])
}

export const removeMessage = (json, name) => write(readSavedMessages(json).filter((entry) => entry.name !== name))
