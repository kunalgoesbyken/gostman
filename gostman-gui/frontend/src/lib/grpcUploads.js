import { maxAttachmentBytes } from './attachments'
import { parseJSON } from './dataUtils'

export const MAX_UPLOADED_PROTO_FILES = 200
const MAX_PROTO_BYTES = 4 * 1024 * 1024

export const maxUploadedProtoBytes = () => Math.min(MAX_PROTO_BYTES, maxAttachmentBytes())

const withinBudget = (count, bytes) => count <= MAX_UPLOADED_PROTO_FILES && bytes <= maxUploadedProtoBytes()

const contentBytes = (files) => files.reduce((sum, file) => sum + new TextEncoder().encode(file.content).byteLength, 0)

export const fitsUploadBudget = (files) => withinBudget(files.length, contentBytes(files))

export const parseUploadedProtos = (json) => {
  const files = parseJSON(json, [])
  return Array.isArray(files) ? files.filter((file) => typeof file?.name === 'string' && typeof file?.content === 'string') : []
}

export const scopedProtos = (layers, requestProtos) => {
  const seen = new Set(requestProtos.map((file) => file.name))
  return [...layers].reverse().flatMap((layer) => parseUploadedProtos(layer.grpcUploadedProtos)).filter((file) => {
    if (seen.has(file.name)) return false
    seen.add(file.name)
    return true
  })
}

export const relativeProtoPath = (file) => {
  const pieces = String(file.webkitRelativePath || file.name || '').replaceAll('\\', '/').split('/')
  const name = (pieces.length > 1 ? pieces.slice(1) : pieces).join('/')
  if (!name || name.startsWith('/') || name.split('/').some((part) => part === '.' || part === '..' || part === '') || !name.endsWith('.proto')) return ''
  return name
}

export async function readUploadedFolder(fileList) {
  const protoFiles = Array.from(fileList).filter((file) => file.name.endsWith('.proto'))
  if (protoFiles.length === 0) return { kind: 'empty' }
  if (!withinBudget(protoFiles.length, protoFiles.reduce((sum, file) => sum + file.size, 0))) return { kind: 'limit' }
  const paths = protoFiles.map(relativeProtoPath)
  if (paths.some((path) => !path) || new Set(paths).size !== paths.length) return { kind: 'paths' }
  const files = await Promise.all(protoFiles.map(async (file, index) => ({ name: paths[index], content: await file.text() })))
  if (!fitsUploadBudget(files)) return { kind: 'limit' }
  return { kind: 'success', files }
}
