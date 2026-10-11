import { expect } from 'chai'
import { evaluateAssertions } from './assertions'

const LOG_LEVELS = ['log', 'info', 'warn', 'error', 'debug']
const AsyncFunction = (async () => {}).constructor

const printable = (value) => {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

function createConsole(logs) {
  const write = (level) => (...values) => logs.push({ level, text: values.map(printable).join(' ') })
  return Object.fromEntries(LOG_LEVELS.map((level) => [level, write(level)]))
}

const storable = (value) => (value !== null && typeof value === 'object' ? JSON.stringify(value) : value)

function createEnvironment(variables) {
  return {
    get: (name) => variables[name],
    has: (name) => Object.hasOwn(variables, name),
    set: (name, value) => { variables[name] = storable(value) },
    unset: (name) => { delete variables[name] },
    all: () => ({ ...variables }),
  }
}

const findKey = (headers, name) => (
  Object.keys(headers).find((key) => key.toLowerCase() === String(name).toLowerCase())
)

function createRequest(source) {
  const request = { ...source, headers: { ...source.headers } }
  return Object.assign(request, {
    getUrl: () => request.url,
    setUrl: (url) => { request.url = url },
    getMethod: () => request.method,
    setMethod: (method) => { request.method = method },
    getHeaders: () => request.headers,
    setHeaders: (headers) => { request.headers = { ...headers } },
    getHeader: (name) => request.headers[findKey(request.headers, name)],
    setHeader: (name, value) => { request.headers[findKey(request.headers, name) || name] = String(value) },
    getBody: () => request.body,
    setBody: (body) => { request.body = body },
  })
}

function createResponse(source) {
  if (!source) return undefined
  return {
    ...source,
    getStatus: () => source.status,
    getHeaders: () => source.headers,
    getHeader: (name) => source.headers[findKey(source.headers, name)],
    getBody: () => source.body,
    getResponseTime: () => source.responseTime,
  }
}

function createTestRunner(results) {
  let queue = Promise.resolve()
  const run = async (name, check) => {
    try {
      await check()
      results.push({ name, passed: true, message: '' })
    } catch (error) {
      results.push({ name, passed: false, message: printable(error) })
    }
  }
  const test = (name, check) => {
    queue = queue.then(() => run(String(name), check))
  }
  return { test, settled: () => queue }
}

const editedRequest = ({ url, method, headers, body }) => ({ url, method, headers, body })

export async function runJob({ script, assertions, request, response, variables }) {
  const logs = []
  const tests = []
  const runner = createTestRunner(tests)
  const scriptRequest = createRequest(request)
  const environment = createEnvironment(variables)
  const legacy = {
    getVar: environment.get,
    setVar: environment.set,
    getEnvVar: environment.get,
    setEnvVar: environment.set,
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  }

  let error = ''
  try {
    const run = new AsyncFunction('req', 'res', 'env', 'bru', 'test', 'expect', 'console', script || '')
    await run(scriptRequest, createResponse(response), environment, legacy, runner.test, expect, createConsole(logs))
    await runner.settled()
  } catch (failure) {
    error = printable(failure)
  }

  const assertionResults = response ? evaluateAssertions(assertions || '', response) : []
  return { tests: [...assertionResults, ...tests], logs, error, variables, request: editedRequest(scriptRequest) }
}
