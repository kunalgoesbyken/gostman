import { isSentRow, parseRows } from './rows'

export const GRAPHQL_METHOD = 'GRAPHQL'
export const UNTITLED_REQUEST = 'Untitled request'

export const AUTH_BASIC = 'basic'
export const AUTH_BEARER = 'bearer'
export const AUTH_API_KEY = 'apikey'
export const AUTH_IN_HEADER = 'header'
export const AUTH_IN_QUERY = 'query'

export const asText = (value) => (value === undefined || value === null ? '' : String(value))

export const sentRows = (json) => parseRows(json).filter(isSentRow)

export const hasKey = (entry) => asText(entry?.key).trim() !== ''

export const apiKeyLocation = (location) => (location === AUTH_IN_QUERY ? AUTH_IN_QUERY : AUTH_IN_HEADER)
