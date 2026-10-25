import { isPlainObject, parseJSON } from './dataUtils'
import { MCP_PROTOCOL } from './mcp'

export const MEDIA_IMAGE = 'image'
export const MEDIA_AUDIO = 'audio'

const SAFE_TYPES = {
  [MEDIA_IMAGE]: new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp']),
  [MEDIA_AUDIO]: new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'audio/webm', 'audio/flac', 'audio/aac', 'audio/mp4']),
}

const isBase64 = (data) => {
  try {
    atob(data)
    return true
  } catch {
    return false
  }
}

const bareType = (mimeType) => String(mimeType ?? '').split(';')[0].trim().toLowerCase()

function mediaOf(block) {
  if (!isPlainObject(block) || typeof block.data !== 'string') return null
  const safe = SAFE_TYPES[block.type]
  const mimeType = bareType(block.mimeType)
  if (!safe?.has(mimeType) || !isBase64(block.data)) return null
  return { kind: block.type, mimeType, url: `data:${mimeType};base64,${block.data}` }
}

export function mcpMedia(response) {
  if (!response || response.error || response.protocol !== MCP_PROTOCOL) return []
  const result = parseJSON(response.body, null)
  if (!isPlainObject(result) || !Array.isArray(result.content)) return []
  return result.content.map(mediaOf).filter(Boolean)
}
