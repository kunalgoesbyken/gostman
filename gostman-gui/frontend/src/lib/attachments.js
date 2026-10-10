import { bytesToBase64 } from './base64'

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

export const EMPTY_ATTACHMENT = { fileName: '', contentType: '', data: '' }

export async function readAttachment(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  return { fileName: file.name, contentType: file.type, data: bytesToBase64(bytes) }
}
