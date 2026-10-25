import { useEffect, useRef, useState } from 'react'
import { evaluateExtractor, isUsableResponse, readsBodyPath } from '../lib/chaining'
import { pathAllowance } from '../lib/scripting/limits'
import { extractInSandbox } from '../lib/scripting/sandbox'
import { useDebouncedValue } from './useDebouncedValue'

const TYPING_PAUSE_MS = 150
const PENDING = { reason: '', value: '' }
const NO_VALUES = new Map()

const pathOf = (extractor) => extractor.expression.trim()

const outcomeOf = (result) => (result.error ? { reason: result.error } : result.outcomes[0])

function probesOf(rows) {
  const probes = new Map()
  rows.filter(readsBodyPath).forEach((row) => {
    if (!probes.has(pathOf(row))) probes.set(pathOf(row), row)
  })
  return JSON.stringify([...probes])
}

export function useExtractPreview(rows, response) {
  const [found, setFound] = useState({ response: null, values: NO_VALUES })
  const asked = useRef({ response: null, paths: new Set() })
  const probes = useDebouncedValue(probesOf(rows), TYPING_PAUSE_MS)
  const values = found.response === response ? found.values : NO_VALUES

  useEffect(() => {
    if (!isUsableResponse(response)) return
    if (asked.current.response !== response) asked.current = { response, paths: new Set() }
    const current = asked.current
    JSON.parse(probes).forEach(([path, row]) => {
      if (current.paths.has(path)) return
      current.paths.add(path)
      extractInSandbox([row], response, pathAllowance()).then((result) => setFound((shown) => {
        if (asked.current !== current) return shown
        const base = shown.response === response ? shown.values : NO_VALUES
        return { response, values: new Map(base).set(path, outcomeOf(result)) }
      }))
    })
  }, [response, probes])

  return (extractor) => (readsBodyPath(extractor) ? values.get(pathOf(extractor)) ?? PENDING : evaluateExtractor(extractor, response))
}
