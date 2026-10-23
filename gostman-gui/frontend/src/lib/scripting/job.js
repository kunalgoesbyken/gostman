import { expect } from 'chai'
import { substitutePlaceholders, variableMap } from '../placeholders'
import { evaluateAssertions } from './assertions'
import { createBruno } from './bruno'
import { createConsole, errorLine, printable } from './console'
import { createRequest, createResponse, editedRequest } from './exchange'
import { createFlow } from './flow'
import { compileScript, describeFailure } from './scriptRuntime'
import { createRequire } from './modules/require'
import { createCookies } from './scriptCookies'
import { createUtils } from './utils'
import { createVisualizer } from './visualize'

const storable = (value) => (value !== null && typeof value === 'object' ? JSON.stringify(value) : value)

function createEnvironment(variables, environmentName) {
  return {
    name: environmentName,
    get: (name) => variables[name],
    has: (name) => Object.hasOwn(variables, name),
    set: (name, value) => { variables[name] = storable(value) },
    unset: (name) => { delete variables[name] },
    all: () => ({ ...variables }),
    clear: () => Object.keys(variables).forEach((key) => { delete variables[key] }),
    interpolate: (text) => substitutePlaceholders(String(text), variableMap(variables)),
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

async function sendRequest(target) {
  const send = globalThis.hostSend
  if (typeof send !== 'function') throw new Error('sendRequest is not available here.')
  return createResponse(JSON.parse(await send(JSON.stringify(target))))
}

export async function runJob({ script, assertions, request, response, variables, modules, cookies, environment: environmentName }) {
  const logs = []
  const tests = []
  const runner = createTestRunner(tests)
  const environment = createEnvironment(variables, environmentName ?? '')
  const scriptRequest = createRequest(request, environment.interpolate)
  const jar = createCookies(cookies, () => environment.interpolate(scriptRequest.url ?? ''))
  const flow = createFlow()
  let visualization = ''
  const api = {
    req: scriptRequest,
    res: createResponse(response),
    env: environment,
    bru: createBruno({ environment, flow: flow.api, request: scriptRequest, cookies: jar.api, sendRequest }),
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

  const assertionResults = response ? evaluateAssertions(assertions || '', response, variables) : []
  return {
    tests: [...assertionResults, ...tests],
    logs,
    error,
    variables,
    request: editedRequest(scriptRequest),
    flow: flow.state,
    visualization,
    cookies: jar.changes,
  }
}
