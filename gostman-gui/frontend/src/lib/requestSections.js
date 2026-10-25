import { GRAPHQL_METHOD } from './graphqlSchema'
import { GRPC_METHOD, GRPC_PANEL } from './grpc'
import { MCP_METHOD, MCP_PANEL, isLocalCommand } from './mcp'
import { SOCKET_PANEL } from './socketSessions'

export const PARAMS_PANEL = 'params'
export const HEADERS_PANEL = 'headers'
export const BODY_PANEL = 'body'
export const AUTH_PANEL = 'auth'
export const GRAPHQL_PANEL = 'graphql'
export const VARS_PANEL = 'vars'
export const EXTRACT_PANEL = 'extract'
export const TESTS_PANEL = 'tests'
export const SETTINGS_PANEL = 'settings'

const KIND_HTTP = 'http'
const KIND_GRAPHQL = 'graphql'
const KIND_GRAPHQL_SOCKET = 'graphqlSocket'
const KIND_SOCKET = 'socket'
const KIND_GRPC = 'grpc'
const KIND_MCP = 'mcp'
const KIND_MCP_COMMAND = 'mcpCommand'

const SECTION_ORDER = [
  PARAMS_PANEL, HEADERS_PANEL, BODY_PANEL, AUTH_PANEL, GRAPHQL_PANEL, GRPC_PANEL, MCP_PANEL, SOCKET_PANEL,
  VARS_PANEL, EXTRACT_PANEL, TESTS_PANEL, SETTINGS_PANEL,
]

const EVERY_KIND = [HEADERS_PANEL, VARS_PANEL, SETTINGS_PANEL]
const RESULT_CHECKS = [EXTRACT_PANEL, TESTS_PANEL]

const KINDS = {
  [KIND_HTTP]: { lead: [], also: [PARAMS_PANEL, BODY_PANEL, AUTH_PANEL, ...RESULT_CHECKS] },
  [KIND_GRAPHQL]: { lead: [GRAPHQL_PANEL], also: [PARAMS_PANEL, AUTH_PANEL, ...RESULT_CHECKS] },
  [KIND_GRAPHQL_SOCKET]: { lead: [SOCKET_PANEL, GRAPHQL_PANEL], also: [PARAMS_PANEL, AUTH_PANEL] },
  [KIND_SOCKET]: { lead: [SOCKET_PANEL], also: [PARAMS_PANEL, AUTH_PANEL] },
  [KIND_GRPC]: { lead: [GRPC_PANEL], also: [AUTH_PANEL, ...RESULT_CHECKS] },
  [KIND_MCP]: { lead: [MCP_PANEL], also: [PARAMS_PANEL, AUTH_PANEL, ...RESULT_CHECKS] },
  [KIND_MCP_COMMAND]: { lead: [MCP_PANEL], also: RESULT_CHECKS },
}

export function requestKind(request, isSocket) {
  const isGraphQL = request.method === GRAPHQL_METHOD
  if (isSocket) return isGraphQL ? KIND_GRAPHQL_SOCKET : KIND_SOCKET
  if (request.method === MCP_METHOD) return isLocalCommand(request) ? KIND_MCP_COMMAND : KIND_MCP
  if (request.method === GRPC_METHOD) return KIND_GRPC
  return isGraphQL ? KIND_GRAPHQL : KIND_HTTP
}

export const leadSection = (kind) => KINDS[kind].lead[0] ?? PARAMS_PANEL

export const hasProtocolPanel = (kind) => KINDS[kind].lead.length > 0

export function requestSections(kind, filled) {
  const { lead, also } = KINDS[kind]
  const applies = new Set([...EVERY_KIND, ...also])
  const rest = SECTION_ORDER.filter((section) => !lead.includes(section) && (applies.has(section) || filled.has(section)))
  return [...lead, ...rest]
}

export const SETTING_TIMEOUT = 'timeout'
export const SETTING_REDIRECTS = 'redirects'
export const SETTING_TLS = 'tls'
export const SETTING_SEND_COOKIES = 'sendCookies'
export const SETTING_STORE_COOKIES = 'storeCookies'
export const SETTING_STREAM = 'stream'

const IS_CHANGED = {
  [SETTING_TIMEOUT]: (options) => options.timeoutMs > 0,
  [SETTING_REDIRECTS]: (options) => options.noFollowRedirects,
  [SETTING_TLS]: (options) => options.insecureTLS,
  [SETTING_SEND_COOKIES]: (options) => options.skipCookies,
  [SETTING_STORE_COOKIES]: (options) => options.discardCookies,
  [SETTING_STREAM]: (options) => options.stream,
}

const SETTING_ORDER = Object.keys(IS_CHANGED)
const CONNECTION_SETTINGS = [SETTING_TIMEOUT, SETTING_TLS]

const SETTINGS_BY_KIND = {
  [KIND_HTTP]: SETTING_ORDER,
  [KIND_GRAPHQL]: SETTING_ORDER,
  [KIND_GRAPHQL_SOCKET]: [],
  [KIND_SOCKET]: [],
  [KIND_GRPC]: CONNECTION_SETTINGS,
  [KIND_MCP]: CONNECTION_SETTINGS,
  [KIND_MCP_COMMAND]: [SETTING_TIMEOUT],
}

export const hasChangedSettings = (options) => SETTING_ORDER.some((setting) => Boolean(IS_CHANGED[setting](options)))

export const requestSettings = (kind, options) => new Set(
  SETTING_ORDER.filter((setting) => SETTINGS_BY_KIND[kind].includes(setting) || IS_CHANGED[setting](options)),
)
