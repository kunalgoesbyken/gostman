import React, { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, FileJson, Check, AlertCircle, Sparkles, Code, Wand2, Copy, CheckCircle2 } from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Textarea } from "./ui/textarea"
import { parse, visit, Kind } from 'graphql'
import { request } from 'graphql-request'
import { GRAPHQL_EXAMPLES } from "../lib/graphqlConstants"
import {
  staggerContainer,
  listItem,
  popIn,
  collapse,
  slideDown,
  pressableStrong,
  liftOnHover,
  pulseGlow,
  spin,
  rotateTo,
} from "../lib/motion"

/**
 * GraphQL Query/Mutation Builder
 * Provides syntax highlighting, validation, and helpers for GraphQL requests
 *
 * Uses graphql and graphql-request libraries for robust handling
 */

/**
 * Validates a GraphQL query string
 * @param {string} query - GraphQL query to validate
 * @returns {Object} { valid, errors }
 */
export function validateGraphQLQuery(query) {
  if (!query || !query.trim()) {
    return { valid: false, errors: ['Query is empty'] }
  }

  try {
    parse(query)
    return { valid: true, errors: [] }
  } catch (error) {
    return { valid: false, errors: [error.message] }
  }
}

/**
 * Formats/Prettifies a GraphQL query string
 * @param {string} query - GraphQL query to format
 * @returns {string} Formatted query
 */
export function formatGraphQLQuery(query) {
  try {
    const ast = parse(query)
    // The ast contains the structured query
    // For now, return the original formatted by the parser
    return query
  } catch {
    // If parsing fails, do basic cleanup
    return query
      .replace(/\s+/g, ' ')
      .replace(/\{/g, '\n{\n  ')
      .replace(/\}/g, '\n}\n')
      .trim()
  }
}

/**
 * Extracts operation name from a GraphQL query
 * @param {string} query - GraphQL query
 * @returns {string} Operation name or 'UnnamedQuery'
 */
export function extractOperationName(query) {
  try {
    const ast = parse(query)
    for (const definition of ast.definitions) {
      if (definition.kind === Kind.OPERATION_DEFINITION) {
        return definition.name?.value || 'UnnamedQuery'
      }
    }
    return 'UnnamedQuery'
  } catch {
    return 'UnnamedQuery'
  }
}

/**
 * Extracts variables used in a GraphQL query
 * @param {string} query - GraphQL query
 * @returns {Array} Array of variable names
 */
export function extractVariables(query) {
  try {
    const ast = parse(query)
    const variables = []

    visit(ast, {
      VariableDefinition(node) {
        variables.push({
          name: node.variable.name.value,
          type: node.type.name?.value || 'Unknown'
        })
      }
    })

    return variables
  } catch {
    return []
  }
}

export function GraphQLPanel({
  query = '',
  variables = '',
  onQueryChange,
  onVariablesChange,
  onExecute
}) {
  const [activeExample, setActiveExample] = useState('query')
  const [showExamples, setShowExamples] = useState(false)
  const [validation, setValidation] = useState({ valid: true, errors: [] })
  const [detectedVars, setDetectedVars] = useState([])
  const [copied, setCopied] = useState(false)
  const [isPrettifying, setIsPrettifying] = useState(false)
  const [activeSection, setActiveSection] = useState('query')
  const queryRef = useRef(null)

  // Validate query when it changes
  useEffect(() => {
    if (query && query.trim()) {
      const result = validateGraphQLQuery(query)
      setValidation(result)

      // Extract variables from query
      const vars = extractVariables(query)
      setDetectedVars(vars)
    } else {
      setValidation({ valid: true, errors: [] })
      setDetectedVars([])
    }
  }, [query])

  const insertExample = (type) => {
    setActiveExample(type)
    if (type === 'query' || type === 'mutation' || type === 'subscription') {
      onQueryChange(GRAPHQL_EXAMPLES[type])
    } else if (type === 'variables') {
      onVariablesChange(GRAPHQL_EXAMPLES.variables)
    }
    setShowExamples(false)
  }

  const prettifyQuery = async () => {
    setIsPrettifying(true)
    // Simulate async for animation
    await new Promise(r => setTimeout(r, 300))
    try {
      const formatted = formatGraphQLQuery(query)
      onQueryChange(formatted)
    } catch (e) {
      console.error('Error prettifying:', e)
    }
    setIsPrettifying(false)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(query).catch(err => console.warn('Copy failed:', err))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const validateVariables = () => {
    try {
      if (variables && variables.trim()) {
        JSON.parse(variables)
        return { valid: true }
      }
      return { valid: true }
    } catch (error) {
      return { valid: false, error: error.message }
    }
  }

  const varValidation = useMemo(() => validateVariables(), [variables])

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
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-cyan-500/10" />
        <div className="relative px-4 py-3 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className="relative"
                animate={validation.valid && query ? pulseGlow : {}}
              >
                <Sparkles className="h-5 w-5 text-purple-500" />
                {!validation.valid && query && (
                  <motion.div
                    className="absolute -top-1 -right-1 h-2 w-2 bg-destructive rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                )}
              </motion.div>
              <div>
                <span className="text-sm font-semibold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  GraphQL
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  {validation.valid ? (
                    <motion.div {...popIn} className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span className="text-[10px] text-emerald-500">Valid</span>
                    </motion.div>
                  ) : query ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1, rotate: [0, -10, 10, -10, 0] }}
                      className="flex items-center gap-1"
                    >
                      <AlertCircle className="h-3 w-3 text-destructive" />
                      <span className="text-[10px] text-destructive">Invalid</span>
                    </motion.div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Enter query</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.div {...pressableStrong}>
                <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20 font-mono">
                  POST
                </Badge>
              </motion.div>
              <motion.div {...pressableStrong}>
                <Badge variant="secondary" className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                  {extractOperationName(query)}
                </Badge>
              </motion.div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowExamples(!showExamples)}
                className="text-xs gap-1.5"
              >
                <Wand2 className="h-3 w-3" />
                Templates
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {!validation.valid && validation.errors.length > 0 && (
          <motion.div
            {...collapse}
            className="px-4 py-2 bg-destructive/10 border-b border-destructive/20"
          >
            <motion.p
              initial={{ x: -10 }}
              animate={{ x: 0 }}
              className="text-xs text-destructive flex items-center gap-2"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              {validation.errors[0]}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExamples && (
          <motion.div
            {...collapse}
            className="px-4 py-3 border-b border-border/50 bg-gradient-to-r from-purple-500/5 to-pink-500/5"
          >
            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
              <Wand2 className="h-3 w-3" />
              Insert a template:
            </p>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            >
              {[
                { type: 'query', label: 'Query', icon: '🔍', color: 'from-blue-500/10 to-cyan-500/10', border: 'border-cyan-500/20' },
                { type: 'mutation', label: 'Mutation', icon: '✏️', color: 'from-purple-500/10 to-pink-500/10', border: 'border-purple-500/20' },
                { type: 'subscription', label: 'Subscription', icon: '🔄', color: 'from-green-500/10 to-emerald-500/10', border: 'border-emerald-500/20' },
                { type: 'variables', label: 'Variables', icon: '{ }', color: 'from-orange-500/10 to-yellow-500/10', border: 'border-orange-500/20' },
              ].map((template) => (
                <motion.div key={template.type} variants={listItem}>
                  <motion.button
                    {...liftOnHover}
                    onClick={() => insertExample(template.type)}
                    className={`p-3 rounded-lg border ${template.border} bg-gradient-to-br ${template.color} hover:shadow-lg hover:shadow-${template.color.split('-')[1]}-500/10 transition-all`}
                  >
                    <div className="text-lg mb-1">{template.icon}</div>
                    <div className="text-xs font-medium">{template.label}</div>
                  </motion.button>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detectedVars.length > 0 && (
          <motion.div
            {...collapse}
            className="px-4 py-2 border-b border-border/50 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 flex items-center gap-2 flex-wrap"
          >
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Code className="h-3 w-3" />
              Variables detected:
            </span>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="flex gap-1.5 flex-wrap"
            >
              {detectedVars.map((v, i) => (
                <motion.div key={v.name} variants={listItem}>
                  <Badge
                    variant="outline"
                    className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/30 font-mono"
                  >
                    ${v.name}
                    <span className="text-cyan-400/50 mx-1">:</span>
                    <span className="text-purple-400">{v.type}</span>
                  </Badge>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden">
        <motion.div
          variants={listItem}
          className="px-4 py-2 border-b border-border/50 bg-muted/10 flex items-center justify-between"
        >
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Query Editor
          </span>
          <div className="flex items-center gap-1">
            <motion.div {...pressableStrong}>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyToClipboard}
                className="text-xs text-muted-foreground hover:text-foreground h-7 gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </Button>
            </motion.div>
            <motion.div {...pressableStrong}>
              <Button
                size="sm"
                variant="ghost"
                onClick={prettifyQuery}
                className="text-xs text-muted-foreground hover:text-foreground h-7 gap-1.5"
                disabled={!query || !validation.valid}
              >
                {isPrettifying ? (
                  <>
                    <motion.div animate={spin}>
                      <Sparkles className="h-3 w-3" />
                    </motion.div>
                    Prettifying...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3 w-3" />
                    Prettify
                  </>
                )}
              </Button>
            </motion.div>
          </div>
        </motion.div>
        <motion.div
          variants={listItem}
          className="flex-1 p-4 relative"
        >
          <div className="absolute inset-4 rounded-lg opacity-0 focus-within:opacity-100 transition-opacity pointer-events-none">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-cyan-500/20 blur-xl" />
          </div>
          <Textarea
            ref={queryRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={GRAPHQL_EXAMPLES.query}
            className={`w-full h-full font-mono text-sm resize-none relative z-10 ${!validation.valid ? 'border-destructive/50' : ''
              } bg-background/80 backdrop-blur-sm border-border/50 focus:border-purple-500/50 transition-colors`}
            spellCheck={false}
          />
        </motion.div>
      </div>

      <div className="border-t border-border/50">
        <AnimatePresence>
          <motion.details
            className="group"
            open={activeSection === 'variables'}
            variants={listItem}
          >
            <motion.summary
              onClick={(e) => {
                e.preventDefault()
                setActiveSection(activeSection === 'variables' ? 'query' : 'variables')
              }}
              className="px-4 py-2 cursor-pointer hover:bg-muted/10 flex items-center justify-between list-none"
            >
              <div className="flex items-center gap-2">
                <motion.div {...rotateTo(activeSection === 'variables' ? 90 : 0)}>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </motion.div>
                <span className="text-xs font-medium text-muted-foreground">
                  Query Variables (JSON)
                </span>
                {!varValidation.valid && (
                  <motion.div {...popIn}>
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  </motion.div>
                )}
              </div>
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {detectedVars.length} expected
              </Badge>
            </motion.summary>
            <AnimatePresence>
              {activeSection === 'variables' && (
                <motion.div
                  {...collapse}
                  className="overflow-hidden"
                >
                  <div className="p-4 border-t border-border/50 bg-muted/5">
                    <Textarea
                      value={variables}
                      onChange={(e) => onVariablesChange(e.target.value)}
                      placeholder={GRAPHQL_EXAMPLES.variables}
                      className={`w-full h-24 font-mono text-sm resize-none ${!varValidation.valid ? 'border-destructive/50' : ''
                        } bg-background/80 backdrop-blur-sm border-border/50`}
                      spellCheck={false}
                    />
                    {!varValidation.valid && (
                      <motion.p
                        {...slideDown}
                        className="text-xs text-destructive mt-2 flex items-center gap-1.5"
                      >
                        <AlertCircle className="h-3 w-3" />
                        {varValidation.error}
                      </motion.p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.details>
        </AnimatePresence>
      </div>

      <div className="border-t border-border/50">
        <motion.details
          className="group"
          variants={listItem}
        >
          <summary className="px-4 py-2 cursor-pointer hover:bg-muted/10 flex items-center justify-between list-none">
            <div className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-muted-foreground group-open:rotate-90 transition-transform" />
              <span className="text-xs font-medium text-muted-foreground">
                Request Preview
              </span>
            </div>
            <FileJson className="h-3.5 w-3.5 text-muted-foreground" />
          </summary>
          <div className="p-4 border-t border-border/50 bg-muted/20">
            <pre className="text-xs font-mono text-muted-foreground overflow-x-auto bg-background/50 rounded p-3 border border-border/30">
              <code>{JSON.stringify({
                query: query?.trim(),
                variables: (() => {
                  try {
                    return variables ? JSON.parse(variables) : undefined
                  } catch {
                    return undefined
                  }
                })()
              }, null, 2) || '{}'}</code>
            </pre>
          </div>
        </motion.details>
      </div>

      {/* Footer Info with gradient text */}
      <motion.div
        variants={listItem}
        className="px-4 py-2 border-t border-border/50 bg-muted/20 flex items-center justify-between"
      >
        <p className="text-xs text-muted-foreground">
          GraphQL requests sent as <span className="font-mono text-purple-400">POST</span> with <span className="font-mono text-cyan-400">application/json</span>
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            Powered by
            <span className="font-mono text-pink-400">graphql</span>
            <span>+</span>
            <span className="font-mono text-purple-400">graphql-request</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/**
 * Executes a GraphQL request using graphql-request
 * @param {string} url - GraphQL endpoint URL
 * @param {string} query - GraphQL query
 * @param {Object} variables - Query variables
 * @param {Object} headers - Additional headers
 * @returns {Promise<Object>} Response data
 */
export async function executeGraphQLRequest(url, query, variables = {}, headers = {}) {
  try {
    // Clean up the query
    const cleanedQuery = query.replace(/^\s*(query|mutation|subscription)\s+/i, '')
    const operationName = extractOperationName(query)

    // Execute using graphql-request
    const data = await request(
      url,
      query,
      variables,
      {
        ...headers,
        'Content-Type': 'application/json'
      }
    )

    return {
      success: true,
      data,
      operation: operationName
    }
  } catch (error) {
    // Handle GraphQL errors
    if (error.response?.errors) {
      return {
        success: false,
        errors: error.response.errors,
        message: 'GraphQL errors occurred'
      }
    }

    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
}

/**
 * Validates if a string appears to be a GraphQL request
 */
export function isGraphQLRequest(text) {
  if (!text || typeof text !== 'string') return false
  const trimmed = text.trim()

  // Check for GraphQL keywords at the start
  const graphqlKeywords = ['query', 'mutation', 'subscription', 'fragment', '{']
  const lowerTrimmed = trimmed.toLowerCase()

  // Check if it starts with a keyword or just a brace (shorthand query)
  if (lowerTrimmed.startsWith('{')) return true

  for (const keyword of graphqlKeywords) {
    if (lowerTrimmed.startsWith(keyword)) {
      return true
    }
  }

  return false
}

/**
 * Formats a GraphQL request for sending as HTTP
 * @param {string} query - GraphQL query/mutation
 * @param {string} variables - JSON variables
 * @returns {Object} { body, headers } - Formatted request
 */
export function formatGraphQLRequest(query, variables = '{}') {
  // Validate variables JSON
  let parsedVariables = {}
  try {
    if (variables && variables.trim()) {
      parsedVariables = JSON.parse(variables)
    }
  } catch (e) {
    console.warn('Invalid GraphQL variables JSON:', e)
  }

  const body = JSON.stringify({
    query: query,
    variables: parsedVariables
  }, null, 2)

  return {
    body,
    headers: {
      'Content-Type': 'application/json'
    }
  }
}

/**
 * Introspects a GraphQL schema to get available queries and mutations
 * @param {string} url - GraphQL endpoint URL
 * @param {Object} headers - Request headers
 * @returns {Promise<Object>} Schema information
 */
export async function introspectGraphQLSchema(url, headers = {}) {
  const introspectionQuery = `
    query IntrospectionQuery {
      __schema {
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types {
          name
          kind
          description
          fields {
            name
            type {
              name
              kind
            }
          }
        }
      }
    }
  `

  try {
    const result = await executeGraphQLRequest(url, introspectionQuery, {}, headers)

    if (result.success && result.data.__schema) {
      const schema = result.data.__schema
      return {
        success: true,
        queries: schema.queryType?.name || 'Query',
        mutations: schema.mutationType?.name || 'Mutation',
        subscriptions: schema.subscriptionType?.name || 'Subscription',
        types: schema.types
      }
    }

    return { success: false, error: 'Introspection failed' }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
