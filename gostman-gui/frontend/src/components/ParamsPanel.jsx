import React, { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Trash2, Hash, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { staggerContainerFast, listItem, fadeIn, cardEnter, pressableSubtle, wiggle } from "../lib/motion"


let paramIdCounter = 0
const generateParamId = () => `param-${Date.now()}-${paramIdCounter++}`

// Parse URL query string into params array
const parseUrlParams = (url) => {
  if (!url) return []

  // Split URL to get the query string portion only
  // Fragment comes AFTER query string, so we need to extract query first
  const questionMarkIndex = url.indexOf('?')
  if (questionMarkIndex === -1) return []

  const afterQuestion = url.substring(questionMarkIndex + 1)
  // Find where the query string ends (either at # or end of string)
  const hashIndex = afterQuestion.indexOf('#')
  const queryStringOnly = hashIndex === -1 ? afterQuestion : afterQuestion.substring(0, hashIndex)

  if (!queryStringOnly.trim()) return []

  const params = []

  try {
    // Use URLSearchParams for proper parsing (handles encoding, duplicates, etc.)
    const searchParams = new URLSearchParams(queryStringOnly)

    // Iterate ALL entries (including duplicates)
    const allEntries = [...searchParams.entries()]
    allEntries.forEach(([key, value]) => {
      params.push({
        id: generateParamId(),
        key,
        value,
        enabled: true
      })
    })

    return params
  } catch {
    // Manual fallback if URLSearchParams fails
    queryStringOnly.split('&').forEach(param => {
      if (!param) return

      const eqIndex = param.indexOf('=')
      let key, value

      if (eqIndex === -1) {
        key = param
        value = ''
      } else {
        key = param.substring(0, eqIndex)
        value = param.substring(eqIndex + 1)
      }

      if (key) {
        try {
          params.push({
            id: generateParamId(),
            key: decodeURIComponent(key),
            value: decodeURIComponent(value),
            enabled: true
          })
        } catch {
          params.push({
            id: generateParamId(),
            key,
            value,
            enabled: true
          })
        }
      }
    })
    return params
  }
}

// Build URL with params (only enabled params with non-empty keys)
const buildUrlWithParams = (originalUrl, params) => {
  if (!originalUrl) return ''

  try {
    // Extract fragment before processing
    const hashIndex = originalUrl.indexOf('#')
    const urlWithoutFragment = hashIndex === -1 ? originalUrl : originalUrl.substring(0, hashIndex)
    const fragment = hashIndex === -1 ? '' : originalUrl.substring(hashIndex) // Include the #

    // Parse the URL (or construct base URL)
    let baseUrl = urlWithoutFragment
    const questionMarkIndex = urlWithoutFragment.indexOf('?')
    if (questionMarkIndex !== -1) {
      baseUrl = urlWithoutFragment.substring(0, questionMarkIndex)
    }

    // Build query string using URLSearchParams
    const searchParams = new URLSearchParams()
    params
      .filter(p => p.enabled && p.key?.trim())
      .forEach(p => {
        searchParams.append(p.key.trim(), p.value || '')
      })

    const queryString = searchParams.toString()
    return baseUrl + (queryString ? `?${queryString}` : '') + fragment
  } catch {
    return originalUrl
  }
}

// Convert params array to JSON object
const paramsToJson = (params) => {
  const result = {}
  params
    .filter(p => p.enabled && p.key?.trim())
    .forEach(p => {
      const key = p.key.trim()
      const value = p.value || ''

      // Handle duplicate keys by converting to array
      if (key in result) {
        const existing = result[key]
        if (Array.isArray(existing)) {
          existing.push(value)
        } else {
          result[key] = [existing, value]
        }
      } else {
        result[key] = value
      }
    })
  return JSON.stringify(result, null, 2)
}

// Convert JSON object to params array
const jsonToParams = (jsonStr) => {
  try {
    const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr || '{}') : jsonStr
    // Handle null, undefined, or non-object values
    const obj = (parsed && typeof parsed === 'object') ? parsed : {}
    const params = []

    Object.entries(obj).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // Handle arrays (from duplicate keys)
        value.forEach(v => {
          params.push({
            id: generateParamId(),
            key,
            value: v == null ? '' : String(v),
            enabled: true
          })
        })
      } else {
        params.push({
          id: generateParamId(),
          key,
          value: value == null ? '' : String(value),
          enabled: true
        })
      }
    })

    return params
  } catch {
    return []
  }
}

export function ParamsPanel({
  url,
  queryParams,
  onUrlChange,
  onQueryParamsChange
}) {
  // Use a single ref to track if we're updating (prevents loops)
  const isInternalUpdate = useRef(false)
  const lastKnownUrlParams = useRef('')

  // Parse params on mount - prioritize URL params, then JSON params
  const [params, setParams] = useState(() => {
    const urlParams = parseUrlParams(url || '')
    if (urlParams.length > 0) {
      lastKnownUrlParams.current = url
      return urlParams
    }
    return jsonToParams(queryParams || '{}')
  })

  // Ref for tracking the new param to focus
  const newParamIdRef = useRef(null)

  // Stable callbacks
  const handleUrlChange = useCallback(onUrlChange, [onUrlChange])
  const handleQueryParamsChange = useCallback(onQueryParamsChange, [onQueryParamsChange])

  // Extract query string signature for comparison
  const getQueryStringSignature = useCallback((urlStr) => {
    const idx = urlStr.indexOf('?')
    if (idx === -1) return ''
    const hashIdx = urlStr.indexOf('#', idx)
    const end = hashIdx === -1 ? urlStr.length : hashIdx
    return urlStr.substring(idx, end)
  }, [])

  // Sync params when URL changes externally
  useEffect(() => {
    // Skip if we're the ones who changed the URL
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }

    const currentSignature = getQueryStringSignature(url)
    const lastSignature = getQueryStringSignature(lastKnownUrlParams.current)

    // Only process if the query string actually changed
    if (currentSignature === lastSignature) return

    lastKnownUrlParams.current = url
    const urlParams = parseUrlParams(url)

    setParams(prev => {
      // Build a map of existing params by key
      const existingByKey = new Map()
      prev.forEach(p => {
        if (p.key) existingByKey.set(p.key, p)
      })

      // Replace params entirely based on URL (remove old ones, add new ones)
      // This ensures params stay in sync with URL
      const merged = []

      // First, add all URL params
      urlParams.forEach(up => {
        merged.push(up)
      })

      // Then, add any existing params that aren't in the URL (user-added params not yet in URL)
      const urlKeys = new Set(urlParams.map(p => p.key))
      prev.forEach(p => {
        if (p.key && !urlKeys.has(p.key)) {
          merged.push(p)
        }
      })

      return merged
    })
  }, [url, getQueryStringSignature])

  // Sync params when queryParams JSON changes externally
  useEffect(() => {
    // Skip if we're the ones who changed it
    if (isInternalUpdate.current) return

    const jsonParams = jsonToParams(queryParams)
    if (jsonParams.length === 0) return

    setParams(prev => {
      const existingKeys = new Set(prev.filter(p => p.key).map(p => p.key))
      const newParams = jsonParams.filter(jp => !existingKeys.has(jp.key))
      return newParams.length > 0 ? [...prev, ...newParams] : prev
    })
  }, [queryParams])

  // Update URL and queryParams when params change
  useEffect(() => {
    // Skip if this change came from URL/JSON sync
    if (isInternalUpdate.current) return

    // Build new URL with params
    const newUrl = buildUrlWithParams(url, params)
    const jsonStr = paramsToJson(params)

    // Mark as internal update
    isInternalUpdate.current = true

    // Update URL if changed
    if (newUrl !== url) {
      handleUrlChange(newUrl)
      lastKnownUrlParams.current = newUrl
    }

    // Update JSON if changed
    if (jsonStr !== queryParams) {
      handleQueryParamsChange(jsonStr)
    }

    // Reset flag after a delay to ensure parent updates propagate
    const timeoutId = setTimeout(() => {
      isInternalUpdate.current = false
    }, 50)

    return () => clearTimeout(timeoutId)
  }, [params, url, queryParams, handleUrlChange, handleQueryParamsChange])

  // Focus new param when added
  useEffect(() => {
    if (newParamIdRef.current) {
      const input = document.querySelector(`[data-param-id="${newParamIdRef.current}"]`)
      if (input) {
        input.focus()
        input.select()
      }
      newParamIdRef.current = null
    }
  }, [params])

  const addParam = useCallback(() => {
    const newId = generateParamId()
    setParams(prev => [...prev, { id: newId, key: '', value: '', enabled: true }])
    newParamIdRef.current = newId
  }, [])

  const removeParam = useCallback((id) => {
    setParams(prev => prev.filter(p => p.id !== id))
  }, [])

  const updateParam = useCallback((id, field, value) => {
    setParams(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }, [])

  const toggleParam = useCallback((id) => {
    setParams(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p))
  }, [])

  const toggleAll = useCallback((enabled) => {
    setParams(prev => prev.map(p => ({ ...p, enabled })))
  }, [])

  const clearAll = useCallback(() => {
    setParams([])
  }, [])

  const enabledCount = params.filter(p => p.enabled && p.key?.trim()).length
  const totalCount = params.length
  const allEnabled = totalCount > 0 && params.every(p => p.enabled)

  return (
    <motion.div
      className="flex flex-col h-full"
      variants={staggerContainerFast}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        className="relative overflow-hidden"
        variants={listItem}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10" />
        <div className="relative px-4 py-3 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                animate={wiggle}
              >
                <Hash className="h-5 w-5 text-cyan-500" />
              </motion.div>
              <div>
                <span className="text-sm font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Query Parameters
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {totalCount > 0 ? `${enabledCount} of ${totalCount} active` : 'No parameters'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="px-4 py-3 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 border-b border-cyan-500/10"
        variants={listItem}
      >
        <p className="text-xs text-muted-foreground">
          Add query parameters to your URL. Parameters from the URL are automatically loaded here.
        </p>
      </motion.div>

      <motion.div
        className="flex-1 overflow-y-auto"
        variants={listItem}
      >
        <div className="p-2">
          {params.length === 0 ? (
            <motion.div
              {...fadeIn}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <Hash className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <p className="text-sm text-muted-foreground mb-1">No query parameters</p>
              <p className="text-xs text-muted-foreground/60 mb-4">
                Add parameters to your URL or click "Add Parameter"
              </p>
            </motion.div>
          ) : (
            <>
              <div className="grid grid-cols-[40px_1fr_1fr_40px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={allEnabled}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="w-4 h-4 rounded border-border/50"
                  />
                </div>
                <div>Key</div>
                <div>Value</div>
                <div />
              </div>

              <AnimatePresence>
                {params.map((param) => (
                  <motion.div
                    key={param.id}
                    {...cardEnter}
                    className={`grid grid-cols-[40px_1fr_1fr_40px] gap-2 p-2 rounded-lg transition-colors ${
                      !param.enabled ? 'opacity-50 bg-muted/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={param.enabled}
                        onChange={() => toggleParam(param.id)}
                        className="w-4 h-4 rounded border-border/50"
                      />
                    </div>

                    <Input
                      data-param-id={param.id}
                      placeholder="Parameter name"
                      value={param.key}
                      onChange={(e) => updateParam(param.id, 'key', e.target.value)}
                      className="h-9 text-sm bg-background/50 font-mono"
                      disabled={!param.enabled}
                    />

                    <Input
                      placeholder="Value"
                      value={param.value}
                      onChange={(e) => updateParam(param.id, 'value', e.target.value)}
                      className="h-9 text-sm bg-background/50 font-mono"
                      disabled={!param.enabled}
                    />

                    <div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeParam(param.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </>
          )}

          <motion.div {...pressableSubtle} className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addParam}
              className="w-full gap-2 border-dashed"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Parameter
            </Button>
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        className="px-4 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between"
        variants={listItem}
      >
        <p className="text-xs text-muted-foreground">
          {enabledCount > 0 ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              {enabledCount} parameter{enabledCount > 1 ? 's' : ''} will be sent
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
              No parameters to send
            </span>
          )}
        </p>
        {totalCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Clear All
          </Button>
        )}
      </motion.div>
    </motion.div>
  )
}
