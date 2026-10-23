import { addressParts } from './destinations'
import { createEditableHeaderList, createHeaderList, headerEntries } from './propertyList'
import { queryValue } from './query'

const headerLine = (key, value) => `${key}: ${value}\r\n`

const findKey = (headers, name) => (
  Object.keys(headers).find((key) => key.toLowerCase() === String(name).toLowerCase())
)

const rawBody = (body) => (typeof body === 'string' || body === undefined ? body : JSON.stringify(body))

export function createRequest(source, resolve) {
  const request = { ...source, headers: { ...source.headers } }
  const setHeader = (name, value) => { request.headers[findKey(request.headers, name) || name] = String(value) }
  const deleteHeader = (name) => {
    const key = findKey(request.headers, name)
    if (key !== undefined) delete request.headers[key]
  }
  const parts = () => addressParts(resolve(request.url ?? ''))
  return Object.assign(request, {
    getName: () => request.name,
    getUrl: () => request.url,
    setUrl: (url) => { request.url = url },
    getHost: () => parts().host,
    getPath: () => parts().path,
    getQueryString: () => parts().query,
    getMethod: () => request.method,
    setMethod: (method) => { request.method = method },
    getHeaders: () => request.headers,
    setHeaders: (headers) => { request.headers = { ...headers } },
    getHeader: (name) => request.headers[findKey(request.headers, name)],
    setHeader,
    deleteHeader,
    deleteHeaders: (names) => names.forEach(deleteHeader),
    headerList: createEditableHeaderList(() => request.headers, { setHeader, deleteHeader }),
    getBody: (options) => (options?.raw ? rawBody(request.body) : request.body),
    setBody: (body) => { request.body = body },
    getTimeout: () => request.timeout,
    setTimeout: (milliseconds) => { request.timeout = Number(milliseconds) },
  })
}

export const editedRequest = ({ url, method, headers, body, timeout }) => ({ url, method, headers, body, timeout })

const headerBytes = (headers) => headerEntries(headers).reduce((total, { key, value }) => total + headerLine(key, value).length, 0)

export function createResponse(source) {
  if (!source) return undefined
  const response = (path, ...filters) => queryValue(response.body, path, ...filters)
  const fields = () => Object.fromEntries(Object.keys(source).map((key) => [key, response[key]]))
  const size = () => {
    const headers = headerBytes(response.headers)
    return { body: response.size, headers, total: response.size + headers }
  }
  return Object.assign(response, source, {
    getStatus: () => response.status,
    getStatusText: () => response.statusText,
    getHeaders: () => response.headers,
    getHeader: (name) => response.headers[findKey(response.headers, name)],
    headerList: createHeaderList(() => response.headers),
    getBody: () => response.body,
    setBody: (body) => { response.body = body },
    getResponseTime: () => response.responseTime,
    getUrl: () => response.url,
    getSize: size,
    toJSON: fields,
  })
}
