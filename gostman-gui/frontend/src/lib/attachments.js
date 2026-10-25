import { bytesToBase64 } from './base64'
import { parseJSON } from './dataUtils'

const RELAYED_ATTACHMENT_BYTES = 3 * 1024 * 1024
const LOCAL_ATTACHMENT_BYTES = 5 * 1024 * 1024

export const EMPTY_ATTACHMENT = { fileName: '', contentType: '', data: '' }

const PATH_SEPARATORS = /[\\/]/

let disk = null

export const allowDiskAttachments = (bindings) => {
  disk = bindings
}

export const canAttachFromDisk = () => disk !== null

export const measureAttachment = (path) => disk.measure(path)

export const maxAttachmentBytes = () => (canAttachFromDisk() ? LOCAL_ATTACHMENT_BYTES : RELAYED_ATTACHMENT_BYTES)

export async function pickAttachment(title) {
  const path = await disk.pick(title)
  if (!path) return null
  return { ...EMPTY_ATTACHMENT, fileName: path.split(PATH_SEPARATORS).pop(), path }
}

export async function readAttachment(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  return { fileName: file.name, contentType: file.type, data: bytesToBase64(bytes), path: '' }
}

const isAttachedFile = (value) => Boolean(value) && typeof value === 'object' && typeof value.path === 'string' && value.path !== '' && 'fileName' in value

const holdsAttachedFile = (parsed) => (Array.isArray(parsed) ? parsed.some(isAttachedFile) : isAttachedFile(parsed))

export const attachesFile = (body) => holdsAttachedFile(parseJSON(body, null))

const detached = (value) => (isAttachedFile(value) ? { ...value, path: '' } : value)

export function withoutAttachedFiles(body) {
  const parsed = parseJSON(body, null)
  if (!holdsAttachedFile(parsed)) return body
  return JSON.stringify(Array.isArray(parsed) ? parsed.map(detached) : detached(parsed))
}
