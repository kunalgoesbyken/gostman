import { expect } from 'chai'
import { evaluateAssertions } from './assertions'
import { createConsole, errorLine, printable } from './console'
import { createFlow } from './flow'
import { compileScript, describeFailure } from './scriptRuntime'
import { createRequire } from './modules/require'
import { createUtils } from './utils'
import { createVisualizer } from './visualize'

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
      results.push({ name, passed: false, message: error instanceof Error ? error.message : printable(error) })
    }
  }
  const test = (name, check) => {
    queue = queue.then(() => run(String(name), check))
  }
  return { test, settled: () => queue }
}

const editedRequest = ({ url, method, headers, body }) => ({ url, method, headers, body })

async function sendRequest(target) {
  const send = globalThis.hostSend
  if (typeof send !== 'function') throw new Error('sendRequest is not available here.')
  return createResponse(JSON.parse(await send(JSON.stringify(target))))
}

export async function runJob({ script, assertions, request, response, variables, modules }) {
  const logs = []
  const tests = []
  const runner = createTestRunner(tests)
  const scriptRequest = createRequest(request)
  const environment = createEnvironment(variables)
  const flow = createFlow()
  let visualization = ''
  const legacy = {
    getVar: environment.get,
    setVar: environment.set,
    getEnvVar: environment.get,
    setEnvVar: environment.set,
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    sendRequest,
    runner: flow.api,
  }
  const api = {
    req: scriptRequest,
    res: createResponse(response),
    env: environment,
    bru: legacy,
    test: runner.test,
    expect,
    console: createConsole(logs),
    sendRequest,
    visualize: createVisualizer((html) => { visualization = html }),
    utils: createUtils(),
    require: createRequire(modules),
    ...flow.api,
  }

  let error = ''
  try {
    const run = compileScript(Object.keys(api), script || '')
    await run(...Object.values(api))
    await runner.settled()
  } catch (failure) {
    error = await describeFailure(failure)
    logs.push(errorLine(error))
  }

  const assertionResults = response ? evaluateAssertions(assertions || '', response) : []
  return {
    tests: [...assertionResults, ...tests],
    logs,
    error,
    variables,
    request: editedRequest(scriptRequest),
    flow: flow.state,
    visualization,
  }
}
