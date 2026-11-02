import { isPlainObject, parseJSON } from './dataUtils'

export const NOTE_LIMIT = 200
export const NOTE_TEXT_LIMIT = 4000
export const AUTHOR_LIMIT = 80

const textOf = (value, limit) => (typeof value === 'string' ? value.slice(0, limit) : '')

function toNote(raw) {
  const text = textOf(raw.text, NOTE_TEXT_LIMIT)
  if (text.trim() === '') return null
  return {
    id: textOf(raw.id, AUTHOR_LIMIT) || crypto.randomUUID(),
    author: textOf(raw.author, AUTHOR_LIMIT).trim(),
    at: textOf(raw.at, AUTHOR_LIMIT),
    text,
    resolved: raw.resolved === true,
  }
}

export function parseNotes(json) {
  const stored = parseJSON(json, [])
  if (!Array.isArray(stored)) return []
  return stored.filter(isPlainObject).map(toNote).filter(Boolean).slice(0, NOTE_LIMIT)
}

export const serializeNotes = (notes) => (notes.length > 0 ? JSON.stringify(notes) : '')

export const openNoteCount = (json) => parseNotes(json).filter((note) => !note.resolved).length

export function withNote(notes, { text, author, at }) {
  const note = toNote({ id: crypto.randomUUID(), author, at, text })
  return note && notes.length < NOTE_LIMIT ? [...notes, note] : notes
}

export const withResolved = (notes, id, resolved) => notes.map((note) => (note.id === id ? { ...note, resolved } : note))

export const withoutNote = (notes, id) => notes.filter((note) => note.id !== id)
