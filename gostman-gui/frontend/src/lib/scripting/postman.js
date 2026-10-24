import { expect } from 'chai'
import { isPlainObject } from '../dataUtils'
import { readParamRows, writeParamRows } from '../queryString'
import { markResponse } from './postmanAssertions'
import { createPropertyList } from './propertyList'
import { SCOPE_COLLECTION, SCOPE_ENVIRONMENT, SCOPE_GLOBAL, SCOPE_SESSION } from './scopes'

const EVENT_PRE_REQUEST = 'prerequest'
const EVENT_TEST = 'test'
const BODY_MODES = { json: 'raw', text: 'raw', xml: 'raw', soap: 'raw', form: 'urlencoded', multipart: 'formdata', binary: 'file' }
const MODE_RAW = 'raw'
const MODE_URLENCODED = 'urlencoded'
const MODE_GRAPHQL = 'graphql'
const CONTENT_TYPE = 'Content-Type'
const FORM_TYPE = 'application/x-www-form-urlencoded'
const QUERY_PAIR = '='
const QUERY_SEPARATOR = '&'

const variableScope = (scope) => ({
  get: scope.get,
  has: scope.has,
  set: scope.set,
  unset: scope.unset,
  clear: scope.clear,
  toObject: scope.all,
  toJSON: scope.all,
  replaceIn: scope.interpolate,
})

const itemPair = (item, value) => (
  isPlainObject(item) ? { key: String(item.key), value: String(item.value ?? '') } : { key: String(item), value: String(value ?? '') }
)

const keyOf = (item) => (isPlainObject(item) ? item.key : item)

function queryList(request) {
  const rows = () => readParamRows(request.url ?? '', '')
  const write = (next) => request.setUrl(writeParamRows(request.url ?? '', next).url)
  const upsert = (item, value) => {
    const pair = itemPair(item, value)
    const current = rows()
    const index = current.findIndex((row) => row.key === pair.key)
    write(index === -1 ? [...current, { ...pair, enabled: true }] : current.map((row, at) => (at === index ? { ...row, value: pair.value } : row)))
  }
  const remove = (target) => write(rows().filter((row) => (typeof target === 'function' ? !target(row) : row.key !== keyOf(target))))
  return {
    ...createPropertyList({
      read: () => rows().map(({ key, value }) => ({ key, value })),
      sameKey: (first, second) => first === second,
      format: ({ key, value }) => `${key}${QUERY_PAIR}${value}`,
      separator: QUERY_SEPARATOR,
    }),
    add: (item, value) => write([...rows(), { ...itemPair(item, value), enabled: true }]),
    upsert,
    remove,
    clear: () => write([]),
  }
}

const postmanUrl = (request) => ({
  toString: () => request.url ?? '',
  getRaw: () => request.url ?? '',
  getHost: request.getHost,
  getPath: request.getPath,
  getQueryString: request.getQueryString,
  update: (url) => request.setUrl(String(url)),
  query: queryList(request),
})

const bodyContent = (content) => (isPlainObject(content) && typeof content.raw === 'string' ? content.raw : content)

function postmanBody(request) {
  const raw = () => request.getBody({ raw: true }) ?? ''
  return {
    get mode() { return BODY_MODES[request.bodyType] },
    get raw() { return raw() },
    update: (content) => request.setBody(bodyContent(content)),
    toString: raw,
    isEmpty: () => raw() === '',
  }
}

function postmanRequest(request) {
  const headers = request.headerList
  return {
    get url() { return postmanUrl(request) },
    set url(value) { request.setUrl(String(value)) },
    get method() { return request.method },
    set method(value) { request.setMethod(String(value).toUpperCase()) },
    get name() { return request.name },
    headers,
    body: postmanBody(request),
    addHeader: (header) => headers.add(header),
    upsertHeader: (header) => headers.upsert(header),
    removeHeader: (name) => headers.remove(name),
    getHeaders: () => headers.toObject(),
  }
}

export function postmanResponse(response) {
  if (!response) return undefined
  const text = () => (typeof response.body === 'string' ? response.body : JSON.stringify(response.body) ?? '')
  const wrapped = {
    get code() { return response.status },
    get status() { return response.statusText },
    headers: response.headerList,
    get responseTime() { return response.responseTime },
    get responseSize() { return response.size },
    json: () => (typeof response.body === 'string' ? JSON.parse(response.body) : response.body),
    text,
    reason: () => response.statusText,
    size: () => {
      const { body, headers, total } = response.getSize()
      return { body, header: headers, total }
    },
    get to() { return expect(wrapped).to },
  }
  return markResponse(wrapped)
}

function headersOf(header) {
  if (!header) return {}
  if (Array.isArray(header)) return Object.fromEntries(header.filter((item) => item && !item.disabled).map(({ key, value }) => [key, value]))
  return typeof header.toObject === 'function' ? header.toObject() : { ...header }
}

const formText = (rows) => (rows || [])
  .filter((row) => row && !row.disabled)
  .map(({ key, value }) => `${encodeURIComponent(key)}${QUERY_PAIR}${encodeURIComponent(value ?? '')}`)
  .join(QUERY_SEPARATOR)

function bodyOf(body) {
  if (body === undefined || body === null || typeof body === 'string') return body ?? ''
  if (body.mode === MODE_RAW) return body.raw ?? ''
  if (body.mode === MODE_URLENCODED) return formText(body.urlencoded)
  if (body.mode === MODE_GRAPHQL) return body.graphql ?? {}
  return body
}

const hasHeader = (headers, name) => Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase())

function postmanTarget(options) {
  if (typeof options === 'string' || !isPlainObject(options)) return { url: String(options) }
  const headers = headersOf(options.header ?? options.headers)
  if (options.body?.mode === MODE_URLENCODED && !hasHeader(headers, CONTENT_TYPE)) headers[CONTENT_TYPE] = FORM_TYPE
  return { url: String(options.url ?? ''), method: options.method, headers, body: bodyOf(options.body), timeout: options.timeout }
}

const postmanJar = (jar, respond) => ({
  set: (url, name, value, callback) => (
    isPlainObject(name) ? respond(jar.setCookie(url, name), value) : respond(jar.setCookie(url, name, value), callback)
  ),
  get: (url, name, callback) => respond(jar.getCookie(url, name).then((cookie) => cookie?.value), callback),
  getAll: (url, callback) => respond(jar.getCookies(url), callback),
  unset: (url, name, callback) => respond(jar.deleteCookie(url, name), callback),
  clear: (url, callback) => respond(jar.deleteCookies(url), callback),
})

function iterationData(environment) {
  return { get: environment.get, has: environment.has, toObject: environment.all, toJSON: environment.all }
}

function infoOf(environment, request, response) {
  return {
    eventName: response ? EVENT_TEST : EVENT_PRE_REQUEST,
    iteration: Math.max(Number(environment.get('iteration')) || 1, 1) - 1,
    iterationCount: Number(environment.get('iterationCount')) || 1,
    requestName: request.name,
    requestId: '',
  }
}

export function createPostman({ scopes, environmentName, request, response, cookies, flow, test, sendRequest, respond, visualize }) {
  const environment = scopes[SCOPE_ENVIRONMENT]
  return {
    environment: { ...variableScope(environment), name: environmentName },
    variables: variableScope(scopes[SCOPE_SESSION]),
    collectionVariables: variableScope(scopes[SCOPE_COLLECTION]),
    globals: variableScope(scopes[SCOPE_GLOBAL]),
    iterationData: iterationData(environment),
    request: postmanRequest(request),
    response: postmanResponse(response),
    cookies: { ...cookies, jar: () => postmanJar(cookies.jar(), respond) },
    info: infoOf(environment, request, response),
    sendRequest: (options, callback) => respond(sendRequest(postmanTarget(options)).then(postmanResponse), callback),
    visualizer: { set: (template, data) => visualize(template, data) },
    execution: { setNextRequest: flow.setNextRequest, skipRequest: flow.skipRequest },
    setNextRequest: flow.setNextRequest,
    test,
    expect,
  }
}

export const createInsomnia = (pm) => ({ ...pm, baseEnvironment: pm.collectionVariables })
