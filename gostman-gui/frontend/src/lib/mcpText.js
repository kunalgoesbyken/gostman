import english from '../../../../locales/en/mcp.json'
import { messages } from './i18n/core'
import { formatList } from './i18n/format'

const STDIO_EXAMPLE = 'stdio:npx -y @modelcontextprotocol/server-everything'
const OPERATION_KEYS = {
  'tools/call': 'toolsCall',
  'tools/list': 'toolsList',
  'resources/read': 'resourcesRead',
  'resources/list': 'resourcesList',
  'resources/templates/list': 'resourceTemplatesList',
  'prompts/get': 'promptsGet',
  'prompts/list': 'promptsList',
}
const ITEM_KINDS = { 'tools/call': 'tool', 'resources/read': 'resource', 'prompts/get': 'prompt' }
const SCHEMA_KINDS = { 'tools/call': 'tool', 'prompts/get': 'prompt' }
const TOOL_PLACEHOLDERS = { 'tools/call': 'tool_name', 'resources/read': 'file:///path/to/resource', 'prompts/get': 'prompt_name' }

const asList = (names) => (Array.isArray(names) ? formatList(names, 'unit') : names)

const text = messages('mcp', english, (t) => {
  const byOperation = (group, kinds) => Object.fromEntries(Object.entries(kinds).map(([operation, kind]) => [operation, t(`mcp.${group}.${kind}`)]))
  const finding = (key) => (tool, detail) => t(`mcp.findings.${key}`, { tool, detail })

  return {
    mcp: {
      media: {
        image: (number) => t('mcp.media.image', { number }),
        audio: (number) => t('mcp.media.audio', { number }),
      },
      issuerDetail: (expected, received) => t('mcp.issuerDetail', { expected, received }),
      serverLabel: ({ server, protocolVersion, legacy }) => [
        server.name,
        server.version,
        protocolVersion && t(legacy ? 'mcp.serverProtocolLegacy' : 'mcp.serverProtocol', { version: protocolVersion }),
      ].filter(Boolean).join(' '),
      get operations() {
        return Object.fromEntries(Object.entries(OPERATION_KEYS).map(([operation, key]) => [operation, t(`mcp.operations.${key}`)]))
      },
      get itemLabels() {
        return byOperation('itemLabels', ITEM_KINDS)
      },
      get choose() {
        return byOperation('choose', SCHEMA_KINDS)
      },
      placeholders: TOOL_PLACEHOLDERS,
      get schemaHints() {
        return byOperation('schemaHints', SCHEMA_KINDS)
      },
      get schemaTitles() {
        return byOperation('schemaTitles', SCHEMA_KINDS)
      },
      promptArguments: (prompt) => prompt.arguments.map((argument) => {
        const label = argument.required ? t('mcp.promptArgumentRequired', { name: argument.name }) : argument.name
        return argument.description ? t('mcp.promptArgumentDescribed', { label, description: argument.description }) : label
      }).join('\n'),
      catalogHints: {
        get remote() {
          return t('mcp.catalogHints.remote', { example: STDIO_EXAMPLE })
        },
      },
      findings: {
        shortDescription: finding('shortDescription'),
        similarNames: finding('similarNames'),
        invalidSchema: finding('invalidSchema'),
        undocumentedParameters: finding('undocumentedParameters'),
        unknownRequired: finding('unknownRequired'),
        rejected: finding('rejected'),
        listFailed: (method, detail) => t('mcp.findings.listFailed', { method, detail }),
      },
      schemaProblems: {
        type: (name, type) => t('mcp.schemaProblems.type', { name, type }),
      },
      changes: {
        added: (names) => t('mcp.changes.added', { names: asList(names) }),
        removed: (names) => t('mcp.changes.removed', { names: asList(names) }),
      },
      auth: {
        attempt: ({ url, status, error }) => [url, status || error].filter(Boolean).join(' → '),
      },
      progress: ({ progress, total, message }) => [
        total === undefined ? `${progress}` : t('mcp.progressOf', { progress, total }),
        message,
      ].filter(Boolean).join(' · '),
    },
  }
})

export const MCP_TEXT = text.mcp
export const MCP_OUTPUT_TEXT = text.mcpOutput