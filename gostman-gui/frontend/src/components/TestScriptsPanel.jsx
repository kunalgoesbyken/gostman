import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Plus, Trash2, Code2, FolderOpen, Info, Link2, Zap, ChevronDown, CheckCircle2, Target } from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import {
  extractFromResponse,
  extractFromHeaders,
  VARIABLE_TEMPLATES,
  createTestScript
} from "../lib/chaining"
import {
  staggerContainer,
  listItem,
  popIn,
  popInOut,
  cardEnter,
  collapse,
  slideDown,
  pressable,
  pressableSubtle,
  liftOnHover,
  wiggle,
  springSoft,
} from "../lib/motion"

const scopeConfig = {
  environment: { label: 'Environment', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
  local: { label: 'Local', color: 'text-info', bg: 'bg-info/10', border: 'border-info/20' },
  global: { label: 'Global', color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' }
}

export function TestScriptsPanel({
  response,
  responseStatus,
  responseHeaders,
  variables,
  onVariablesChange,
  onSaveVariables
}) {
  const [extractors, setExtractors] = useState([{ name: '', path: '', scope: 'environment' }])
  const [previewResult, setPreviewResult] = useState(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [extractedCount, setExtractedCount] = useState(0)
  const [showScript, setShowScript] = useState(false)

  // Update preview when response or extractors change
  useEffect(() => {
    if (response && response.trim()) {
      const results = {}
      extractors.forEach((ext, idx) => {
        if (ext.name && ext.path) {
          let value
          if (ext.path.startsWith('header.')) {
            value = extractFromHeaders(responseHeaders, ext.path)
          } else if (ext.path === 'statusCode' || ext.path === 'status') {
            value = responseStatus || ''
          } else {
            value = extractFromResponse(response, ext.path)
          }
          results[idx] = { name: ext.name, value, found: value !== null }
        }
      })
      setPreviewResult(results)
    } else {
      setPreviewResult(null)
    }
  }, [response, responseStatus, responseHeaders, extractors])

  const addExtractor = () => {
    setExtractors([...extractors, { name: '', path: '', scope: 'environment' }])
  }

  const removeExtractor = (index) => {
    setExtractors(extractors.filter((_, i) => i !== index))
  }

  const updateExtractor = (index, field, value) => {
    const updated = [...extractors]
    updated[index][field] = value
    setExtractors(updated)
  }

  const applyExtractions = () => {
    const extracted = {}

    extractors.forEach((ext) => {
      if (ext.name && ext.path) {
        let value
        if (ext.path.startsWith('header.')) {
          value = extractFromHeaders(responseHeaders, ext.path)
        } else if (ext.path === 'statusCode' || ext.path === 'status') {
          value = responseStatus || ''
        } else {
          value = extractFromResponse(response, ext.path)
        }

        if (value !== null) {
          extracted[ext.name] = value
        }
      }
    })

    // Merge with existing variables
    const existing = typeof variables === 'string' ? JSON.parse(variables || '{}') : variables
    const merged = { ...existing, ...extracted }
    onVariablesChange(JSON.stringify(merged, null, 2))

    // Show extracted count
    const count = Object.keys(extracted).length
    setExtractedCount(count)
    setTimeout(() => setExtractedCount(0), 3000)
  }

  const useTemplate = (template) => {
    setExtractors([...extractors, { name: template.name, path: template.path, scope: 'environment' }])
    setShowTemplates(false)
  }

  const generateTestScript = () => {
    const validExtractors = extractors.filter(e => e.name && e.path)
    if (validExtractors.length === 0) return ''

    return validExtractors
      .map(ext => createTestScript(ext.name, ext.path, ext.scope))
      .join('\n')
  }

  const hasResponse = response && response.trim()

  return (
    <motion.div
      className="flex flex-col h-full"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        className="relative overflow-hidden"
        variants={listItem}
      >
        
        <div className="relative px-4 py-3 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                animate={wiggle}
              >
                <Link2 className="h-5 w-5 text-primary" />
              </motion.div>
              <div>
                <span className="text-sm font-semibold text-foreground">
                  Request Chaining
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  {extractedCount > 0 ? (
                    <motion.div
                      key={extractedCount}
                      {...popIn}
                      className="flex items-center gap-1 text-[10px] text-success"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {extractedCount} variable{extractedCount > 1 ? 's' : ''} extracted
                    </motion.div>
                  ) : hasResponse ? (
                    <span className="text-[10px] text-success">Response ready</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Send a request first</span>
                  )}
                </div>
              </div>
            </div>
            <AnimatePresence>
              {hasResponse && (
                <motion.div {...popInOut}>
                  <Badge className="text-xs bg-success/10 text-success border-success/20 gap-1">
                    <Target className="h-3 w-3" />
                    Ready
                  </Badge>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="px-4 py-3 bg-muted/10 border-b border-border/40"
        variants={listItem}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Extract values from responses to use in subsequent requests.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Use <span className="text-primary font-mono">dot.notation</span> for nested values.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="flex-1 overflow-y-auto p-4 space-y-3"
        variants={listItem}
      >
        <AnimatePresence>
          {extractors.map((extractor, idx) => (
            <motion.div
              key={idx}
              {...cardEnter}
              className="relative group"
            >
              <div className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${scopeConfig[extractor.scope]?.bg || scopeConfig.environment.bg}`} />

              <div className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-muted/10 ml-3 hover:border-border/80 transition-colors">
                <Input
                  placeholder="variable_name"
                  value={extractor.name}
                  onChange={(e) => updateExtractor(idx, 'name', e.target.value)}
                  className="flex-1 h-9 text-sm bg-background/50"
                />
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-muted-foreground text-xs">$</span>
                  <Input
                    placeholder="data.user.id"
                    value={extractor.path}
                    onChange={(e) => updateExtractor(idx, 'path', e.target.value)}
                    className="flex-1 h-9 text-sm font-mono bg-background/50"
                  />
                </div>

                <select
                  value={extractor.scope}
                  onChange={(e) => updateExtractor(idx, 'scope', e.target.value)}
                  className={`h-9 px-3 text-sm rounded-md border cursor-pointer transition-colors ${
                    scopeConfig[extractor.scope]?.bg || scopeConfig.environment.bg
                  } ${scopeConfig[extractor.scope]?.border || scopeConfig.environment.border} ${
                    scopeConfig[extractor.scope]?.color || scopeConfig.environment.color
                  }`}
                >
                  <option value="environment">Environment</option>
                  <option value="local">Local</option>
                  <option value="global">Global</option>
                </select>

                <AnimatePresence>
                  {previewResult && previewResult[idx] && extractor.name && extractor.path && (
                    <motion.div {...popInOut}>
                      <Badge
                        variant={previewResult[idx].found ? "default" : "secondary"}
                        className={`gap-1 ${
                          previewResult[idx].found
                            ? "bg-success/20 text-success border-success/30"
                            : "bg-destructive/20 text-destructive border-destructive/30"
                        }`}
                      >
                        {previewResult[idx].found ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            {previewResult[idx].value?.substring(0, 15)}
                            {previewResult[idx].value?.length > 15 ? '...' : ''}
                          </>
                        ) : (
                          <>—</>
                        )}
                      </Badge>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeExtractor(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <motion.div {...pressableSubtle}>
          <Button
            variant="outline"
            size="sm"
            onClick={addExtractor}
            className="w-full gap-2 border-dashed"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Extraction Rule
          </Button>
        </motion.div>
      </motion.div>

      <motion.div
        className="px-4 py-2 border-t border-border/50"
        variants={listItem}
      >
        <motion.button
          {...pressableSubtle}
          onClick={() => setShowTemplates(!showTemplates)}
          className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground py-2"
        >
          <motion.div
            animate={{ rotate: showTemplates ? 180 : 0 }}
            transition={springSoft}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
          {showTemplates ? 'Hide' : 'Show'} common templates
        </motion.button>

        <AnimatePresence>
          {showTemplates && (
            <motion.div
              {...collapse}
              className="overflow-hidden"
            >
              <div className="pt-2 grid grid-cols-2 gap-2">
                {VARIABLE_TEMPLATES.map((template, idx) => (
                  <motion.div
                    key={idx}
                    {...liftOnHover}
                    onClick={() => useTemplate(template)}
                    className="text-left p-3 text-xs rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <Zap className="h-3 w-3 text-primary" />
                      {template.name}
                    </div>
                    <div className="text-muted-foreground font-mono text-[10px] mt-1 bg-background/50 rounded px-1.5 py-0.5">
                      {template.path}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div
        className="px-4 py-2 border-t border-border/50 bg-muted/20"
        variants={listItem}
      >
        <details
          open={showScript}
          onToggle={(e) => setShowScript(e.target.open)}
          className="text-xs"
        >
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-2 select-none">
            <Code2 className="h-3.5 w-3.5" />
            Generated Postman-compatible script
          </summary>
          <motion.div
            {...slideDown}
            className="mt-2"
          >
            <pre className="p-3 bg-background rounded-lg border border-border/30 overflow-x-auto text-xs">
              <code className="text-muted-foreground">{generateTestScript() || '// Add extraction rules to generate script'}</code>
            </pre>
          </motion.div>
        </details>
      </motion.div>

      <motion.div
        className="px-4 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between"
        variants={listItem}
      >
        <p className="text-xs text-muted-foreground">
          {hasResponse ? (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success/40" />
              Response available
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
              Send a request first
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <motion.div {...pressable}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setExtractors([{ name: '', path: '', scope: 'environment' }])}
            >
              Clear All
            </Button>
          </motion.div>
          <motion.div {...pressable}>
            <Button
              size="sm"
              onClick={applyExtractions}
              disabled={!hasResponse || !extractors.some(e => e.name && e.path)}
              className="gap-2"
            >
              <Play className="h-3.5 w-3.5" />
              Extract Variables
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}
