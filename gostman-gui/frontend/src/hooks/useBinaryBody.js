import { useEffect, useState } from 'react'
import { bodyBytes } from '../lib/response'
import { MAX_DECODE_BYTES } from '../lib/binary/limits'
import { isFormat } from '../lib/binary/formats'

export const BINARY_IDLE = 'idle'
export const BINARY_WORKING = 'working'
export const BINARY_DONE = 'done'
export const BINARY_FAILED = 'failed'
export const BINARY_TOO_LARGE = 'tooLarge'

const IDLE = { status: BINARY_IDLE }
const WORKING = { status: BINARY_WORKING }

export const needsBytes = (view) => view === 'hex' || isFormat(view)

async function read(response, view) {
  const bytes = bodyBytes(response)
  if (view === 'hex') return { status: BINARY_DONE, bytes }
  const { decodeToJson } = await import('../lib/binary/codecs')
  if (bytes.length > MAX_DECODE_BYTES) return { status: BINARY_TOO_LARGE, bytes }
  return { status: BINARY_DONE, bytes, text: decodeToJson(view, bytes) }
}

export function useBinaryBody(response, view) {
  const [settled, setSettled] = useState(null)
  const wanted = Boolean(response) && needsBytes(view)

  useEffect(() => {
    if (!wanted) return undefined
    let current = true
    const settle = (result) => current && setSettled({ response, view, result })
    read(response, view).then(settle, (error) => settle({ status: BINARY_FAILED, reason: error.message }))
    return () => {
      current = false
    }
  }, [response, view, wanted])

  if (!wanted) return IDLE
  return settled?.response === response && settled.view === view ? settled.result : WORKING
}
