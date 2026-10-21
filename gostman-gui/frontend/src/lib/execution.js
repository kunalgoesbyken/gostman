import { hasActiveContent } from './activeContent'
import { extractVariables, isUsableResponse, parseExtractors } from './chaining'
import { isPlainObject, parseJSON } from './dataUtils'
import { isGrpcRequest } from './grpc'
import { isMcpRequest } from './mcp'
import { withFreshToken } from './oauth'
import { failureResponse } from './response'
import { countActiveAssertions } from './scripting/assertions'
import { consoleGroup } from './consoleLog'
import { addressHost, collectionHostsBy, isPermittedHost } from './scripting/destinations'
import { holdsBack, reasonFor } from './scripting/flow'
import { MAX_SENDS, SEND_TIMEOUT_MS } from './scripting/limits'
import { applyRequestEdits, requestSubject, responseSubject, runInSandbox } from './scripting/sandbox'
import { scriptedRequest } from './scripting/subjects'
import { promptNames } from './variableScopes'
import { useAppStore, variableTextFor } from '../store/appStore'

const CONFIG_ERROR = 'config'
const PROMPT_DECLINED = 'The request was not sent because the values it asks for were not provided.'
const UNUSABLE_ADDRESS = 'The address cannot be used by a script.'
const SEND_LIMIT = `A script may call sendRequest ${MAX_SENDS} times.`
const PRE_REQUEST = 'Pre-request script'
const POST_RESPONSE = 'Post-response script'
export const RESTRICTED = 'This folder is not trusted yet, so its scripts and OAuth 2.0 settings are switched off. Open the folder menu in the header and choose Trust this folder.'

const store = () => useAppStore.getState()
const variablesText = (request, answers) => variableTextFor(store(), request, answers)
const hasText = (text) => text.trim() !== ''
const isSame = (first, second) => JSON.stringify(first) === JSON.stringify(second)

function readVariables(request) {
  const parsed = parseJSON(variablesText(request), {})
  return isPlainObject(parsed) ? parsed : {}
}

function scriptChanges(before, after) {
  const changed = Object.entries(after).filter(([name, value]) => before[name] !== value)
  const removed = Object.keys(before).filter((name) => !(name in after)).map((name) => [name, null])
  return Object.fromEntries([...changed, ...removed])
}

async function runStage(stage, job, request, send) {
  const variables = readVariables(request)
  const run = await runInSandbox({ ...job, variables }, send)
  if (isPlainObject(run.variables) && !isSame(variables, run.variables)) {
    store().mergeActiveVariables(scriptChanges(variables, run.variables))
  }
  return { ...run, error: run.error ? `${stage}: ${run.error}` : '' }
}

async function askForValues(request) {
  const names = promptNames(request)
  if (names.length === 0) return {}
  const known = readVariables(request)
  return store().askVariables(names, Object.fromEntries(names.map((name) => [name, known[name] ?? ''])))
}

const NO_FLOW = { action: '', target: '' }

const lastFlow = (runs) => runs.map((run) => run.flow).filter((flow) => flow?.action).pop() ?? NO_FLOW

const report = (runs) => ({
  flow: lastFlow(runs),
  visualization: runs.map((run) => run.visualization).filter(Boolean).pop() ?? '',
  results: runs.flatMap((run) => run.tests),
  logs: runs.flatMap((run) => run.logs),
  error: runs.map((run) => run.error).filter(Boolean).join('\n'),
})

export function applyExtractors(request, response) {
  const extractors = parseExtractors(request.extractors)
  if (extractors.length === 0 || !isUsableResponse(response)) return null
  const variables = extractVariables(extractors, response)
  return { saved: store().mergeActiveVariables(variables), names: Object.keys(variables) }
}

const needsPostStage = (request) => hasText(request.postScript) || countActiveAssertions(request.assertions) > 0

function transportFor(backend, request) {
  if (isGrpcRequest(request)) return backend.invokeGrpc
  if (isMcpRequest(request)) return backend.invokeMcp
  return backend.send
}

let scriptSends = 0
let consoleSequence = 0

function createScriptSender(backend) {
  let sent = 0
  return async (target) => {
    if (sent >= MAX_SENDS) throw new Error(SEND_LIMIT)
    sent += 1
    const { requests } = store()
    const request = scriptedRequest(target, requests)
    const timed = { ...request, options: { ...request.options, timeoutMs: request.options.timeoutMs || SEND_TIMEOUT_MS, noFollowRedirects: true } }
    const variables = variablesText(timed, {})
    const host = addressHost(timed.url, variables)
    if (host === '') throw new Error(UNUSABLE_ADDRESS)
    if (!isPermittedHost(host, collectionHostsBy(requests, (candidate) => variablesText(candidate, {})))) {
      throw new Error(`The host "${host}" is not used by this collection, so scripts may not call it.`)
    }
    scriptSends += 1
    const response = await transportFor(backend, timed)(`script-${scriptSends}`, timed, variables, store().cookies)
    if (response.error) throw new Error(response.body)
    return JSON.stringify(responseSubject(response))
  }
}

export function createExecutor(backend) {
  const perform = async (original, sendId, runs) => {
    const send = createScriptSender(backend)
    const stop = (request, message) => ({
      auth: request.auth,
      response: failureResponse(CONFIG_ERROR, message),
      tests: report(runs),
      extraction: null,
    })

    let request = original
    if (store().isRestricted && hasActiveContent(request)) return stop(request, RESTRICTED)
    if (hasText(request.preScript)) {
      const pre = await runStage(PRE_REQUEST, { script: request.preScript, request: requestSubject(request) }, request, send)
      runs.push(pre)
      if (pre.error) return stop(request, pre.error)
      if (holdsBack(pre.flow)) return { ...stop(request, reasonFor(pre.flow)), skipped: reasonFor(pre.flow) }
      request = applyRequestEdits(request, pre.request)
    }

    const answers = await askForValues(request)
    if (answers === null) return stop(request, PROMPT_DECLINED)

    try {
      request = await withFreshToken(backend, request, variablesText(request, answers))
    } catch (error) {
      return stop(request, error.message)
    }

    const transmit = transportFor(backend, request)
    const response = await transmit(sendId, request, variablesText(request, answers), store().cookies)
    store().storeCookies(response.cookies || [])
    const extraction = applyExtractors(request, response)

    if (isUsableResponse(response) && needsPostStage(request)) {
      runs.push(await runStage(POST_RESPONSE, {
        script: request.postScript,
        assertions: request.assertions,
        request: requestSubject(request),
        response: responseSubject(response),
      }, request, send))
    }
    return { auth: request.auth, response, tests: report(runs), extraction }
  }

  return async function execute(original, sendId) {
    const runs = []
    const outcome = await perform(original, sendId, runs)
    const logs = runs.flatMap((run) => run.logs)
    if (logs.length > 0) store().appendConsole(consoleGroup(original, logs, ++consoleSequence))
    return outcome
  }
}
