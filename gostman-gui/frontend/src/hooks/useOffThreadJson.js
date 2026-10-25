import { useCallback, useEffect, useState } from 'react'
import { filterJsonText, formatJsonText } from '../lib/jsonTasks'
import { RESPONSE_TEXT } from '../lib/responseText'

const FORMAT_IDLE = 'idle'
export const FORMAT_WORKING = 'working'
export const FORMAT_DONE = 'done'
export const FORMAT_FAILED = 'failed'

const IDLE = { status: FORMAT_IDLE, text: null, error: '', source: null }
const NO_FILTER = { active: false }

const failure = (error) => RESPONSE_TEXT.formatFailed(error.message)

export function useOffThreadFormat(text) {
  const [formatted, setFormatted] = useState(IDLE)

  const format = useCallback(() => {
    const settle = (next) => setFormatted((current) => (current.source === text ? { ...IDLE, ...next, source: text } : current))
    setFormatted({ ...IDLE, status: FORMAT_WORKING, source: text })
    formatJsonText(text).then(
      (pretty) => settle({ status: FORMAT_DONE, text: pretty }),
      (error) => settle({ status: FORMAT_FAILED, error: failure(error) }),
    )
  }, [text])

  return { formatted: formatted.source === text ? formatted : IDLE, format }
}

export function useOffThreadFilter(text, enabled, path, withValue) {
  const [filter, setFilter] = useState({ text: null, result: NO_FILTER })
  const isActive = enabled && path.trim() !== ''

  useEffect(() => {
    if (!isActive) return undefined
    let isLive = true
    filterJsonText(text, path, withValue).then(
      (result) => isLive && setFilter({ text, result }),
      (error) => isLive && setFilter({ text, result: { active: true, error: failure(error) } }),
    )
    return () => {
      isLive = false
    }
  }, [isActive, text, path, withValue])

  return isActive && filter.text === text ? filter.result : NO_FILTER
}
