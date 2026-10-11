import { normalizeRequest } from './request'

const TEXT_FIELDS = ['name', 'method', 'url', 'body', 'bodyType', 'folderId', 'graphqlQuery', 'graphqlVariables', 'extractors', 'grpcMethod', 'grpcMessage', 'grpcProtos']
const PAIR_FIELDS = ['headers', 'queryParams']
const EMPTY_PAIRS = ['', '{}', '[]']

const BLANK_REQUEST = normalizeRequest()

const samePairs = (first, second) => (
  first === second || (EMPTY_PAIRS.includes(first) && EMPTY_PAIRS.includes(second))
)

const sameSettings = (first, second) => Object.keys(first).every((key) => first[key] === second[key])

function sameRequest(first, second) {
  return TEXT_FIELDS.every((field) => first[field] === second[field])
    && PAIR_FIELDS.every((field) => samePairs(first[field], second[field]))
    && sameSettings(first.auth, second.auth)
    && sameSettings(first.options, second.options)
}

export function isBlankRequest(request) {
  return !request.id && sameRequest(request, { ...BLANK_REQUEST, folderId: request.folderId })
}

export function isRequestDirty(request, saved) {
  return saved ? !sameRequest(request, saved) : !isBlankRequest(request)
}
