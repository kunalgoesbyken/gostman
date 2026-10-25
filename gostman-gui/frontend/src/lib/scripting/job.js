import { expect, use } from 'chai'
import { evaluateAssertions } from './assertions'
import { createBruno } from './bruno'
import { createConsole, errorLine, printable } from './console'
import { createRequest, createResponse, editedRequest } from './exchange'
import { createFlow } from './flow'
import { createInsomnia, createPostman } from './postman'
import { postmanAssertions } from './postmanAssertions'
import { compileScript, describeFailure } from './scriptRuntime'
import { createRequire } from './modules/require'
import { schemaAssertions } from './schemaAssertions'
import { createScopes, SCOPE_COLLECTION, SCOPE_ENVIRONMENT, SCOPE_GLOBAL, SCOPE_SESSION } from './scopes'
import { createCookies } from './scriptCookies'
import { createUtils } from './utils'
import { createVisualizer } from './visualize'

use(schemaAssertions)
use(postmanAssertions)

const createEnvironment = (scopes, environmentName) => ({
  ...scopes[SCOPE_ENVIRONMENT],
  ...scopes.layered,
  name: environmentName,
  session: scopes[SCOPE_SESSION],
  collection: scopes[SCOPE_COLLECTION],
  globals: scopes[SCOPE_GLOBAL],
})

function createTestRunner(results) {
  let queue = Promise.resolve()
  const fail = (entry, error) => {
    entry.passed = false
    entry.message = error instanceof Error ? error.message : printable(error)
  }
  const test = (name, check) => {
    const entry = { name: String(name), passed: true, message: '' }
    results.push(entry)
    try {
      const outcome = check()
      if (typeof outcome?.then !== 'function') return
      const settled = outcome.then(() => {}, (error) => fail(entry, error))
      queue = queue.then(() => settled)
    } catch (error) {
      fail(entry, error)
    }
  }
  test.skip = () => {}
  return { test, settled: () => queue }
}

function createTracker() {
  const pending = new Set()
  const failures = []
  const watch = (promise) => {
    const settled = promise.then(() => {}, (error) => { failures.push(error) })
    pending.add(settled)
    settled.then(() => pending.delete(settled))
    return promise
  }
  const idle = async () => {
    while (pending.size > 0) await Promise.all([...pending])
    if (failures.length > 0) throw failures[0]
  }
  const respond = (promise, callback) => (
    typeof callback === 'function' ? watch(promise.then((value) => callback(null, value), (error) => callback(error))) : promise
  )
  return { respond, idle }
}

async function sendRequest(target) {
  const send = globalThis.hostSend
  if (typeof send !== 'function') throw new Error('sendRequest is not available here.')
  return createResponse(JSON.parse(await send(JSON.stringify(target))))
}

export async function runJob({ script, assertions, request, response, layers, modules, cookies, environment: environmentName }) {
  const logs = []
  const tests = []
  const runner = createTestRunner(tests)
  const tracker = createTracker()
  const scopes = createScopes(layers)
  const name = environmentName ?? ''
  const scriptRequest = createRequest(request, scopes.layered.interpolate)
  const jar = createCookies(cookies, () => scopes.layered.interpolate(scriptRequest.url ?? ''))
  const flow = createFlow()
  let visualization = ''
  const visualize = createVisualizer((html) => { visualization = html })
  const res = createResponse(response)
  const adapters = { scopes, environmentName: name, flow: flow.api, request: scriptRequest, cookies: jar.api, sendRequest, respond: tracker.respond }
  const pm = createPostman({ ...adapters, response: res, test: runner.test, visualize })
  const api = {
    req: scriptRequest,
    res,
    env: createEnvironment(scopes, name),
    bru: createBruno(adapters),
    pm,
    insomnia: createInsomnia(pm),
    test: runner.test,
    expect,
    console: createConsole(logs),
    sendRequest,
    visualize,
    utils: createUtils(),
    require: createRequire(modules),
    ...flow.api,
  }

  let error = ''
  try {
    const run = compileScript(Object.keys(api), script || '')
    await run(...Object.values(api))
    await tracker.idle()
    await runner.settled()
  } catch (failure) {
    error = await describeFailure(failure)
    logs.push(errorLine(error))
  }

  const assertionResults = response ? evaluateAssertions(assertions || '', response, scopes.layered.all()) : []
  return {
    tests: [...assertionResults, ...tests],
    logs,
    error,
    writes: scopes.writes,
    request: editedRequest(scriptRequest),
    flow: flow.state,
    visualization,
    cookies: jar.changes,
  }
}
