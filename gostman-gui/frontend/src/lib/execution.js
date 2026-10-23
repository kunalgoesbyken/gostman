import { hasActiveContent } from './activeContent'
import { extractVariables, isUsableResponse, parseExtractors } from './chaining'
import { isPlainObject, parseJSON } from './dataUtils'
import { isGrpcRequest } from './grpc'
import { inheritedAuthSource, lineageOf, withInheritance } from './inheritance'
import { LOCAL_COMMAND_TEXT, needsApproval } from './localCommands'
import { isLocalCommand, isMcpRequest } from './mcp'
import { withFreshToken } from './oauth'
import { failureResponse } from './response'
import { isStreamRequest } from './sse'
import { transmitStream } from './sseTransport'
import { countActiveAssertions } from './scripting/assertions'
import { consoleGroup } from './consoleLog'
import { addressHost, collectionHostsBy, isPermittedHost } from './scripting/destinations'
import { holdsBack, reasonFor } from './scripting/flow'
import { MAX_SENDS, SEND_TIMEOUT_MS } from './scripting/limits'
import { applyRequestEdits, requestSubject, responseSubject, runInSandbox } from './scripting/sandbox'
import { acceptedCookies, scriptCookies } from './scripting/scriptCookies'
import { scriptedRequest } from './scripting/subjects'
import { SECRETS_TEXT } from './secretsText'
import { ENTRY_KINDS, exchangeEntry, scriptEntry, withActivity } from './timeline'
import { promptNames, referenceTargets } from './variableScopes'
import { findActiveEnvironment, useAppStore, variableTextFor } from '../store/appStore'

const CONFIG_ERROR = 'config'
const PROMPT_DECLINED = 'The request was not sent because the values it asks for were not provided.'
const UNUSABLE_ADDRESS = 'The address cannot be used by a script.'
const SEND_LIMIT = `A script may call sendRequest ${MAX_SENDS} times.`
const PRE_REQUEST = 'Pre-request script'
const POST_RESPONSE = 'Post-response script'
export const RESTRICTED = 'This folder is not trusted yet, so its scripts, OAuth 2.0 settings and local MCP commands are switched off. Open the folder menu in the header and choose Trust this folder.'

const store = () => useAppStore.getState()
const variablesText = (request, answers, referenced) => variableTextFor(store(), request, answers, referenced)
const hasText = (text) => text.trim() !== ''
const isSame = (first, second) => JSON.stringify(first) === JSON.stringify(second)

function readVariables(request, referenced) {
  const parsed = parseJSON(variablesText(request, undefined, referenced), {})
  return isPlainObject(parsed) ? parsed : {}
}

function scriptChanges(before, after) {
  const changed = Object.entries(after).filter(([name, value]) => before[name] !== value)
  const removed = Object.keys(before).filter((name) => !(name in after)).map((name) => [name, null])
  return Object.fromEntries([...changed, ...removed])
}

function createTrace() {
  const origin = performance.now()
  const entries = []
  const now = () => performance.now() - origin
  const timed = async (record, work) => {
    const startMs = now()
    const result = await work()
    entries.push(record(result, startMs, now()))
    return result
  }
  return { entries, timed }
}

const scriptHosts = () => collectionHostsBy(store().requests, (candidate) => variablesText(candidate, {}))

async function runStage(stage, job, request, { send, trace, referenced }) {
  const variables = readVariables(request, referenced)
  const hosts = scriptHosts()
  const cookies = scriptCookies(store().cookies, hosts)
  const environment = findActiveEnvironment(store())?.name ?? ''
  const run = await trace.timed(scriptEntry(stage), () => runInSandbox({ ...job, variables, cookies, environment }, send))
  if (isPlainObject(run.variables) && !isSame(variables, run.variables)) {
    store().mergeActiveVariables(scriptChanges(variables, run.variables))
  }
  const changed = acceptedCookies(run.cookies, hosts)
  if (changed.length > 0) store().storeCookies(changed)
  return { ...run, error: run.error ? `${stage}: ${run.error}` : '' }
}

async function askForValues(request, referenced) {
  const names = promptNames(request)
  if (names.length === 0) return {}
  const known = readVariables(request, referenced)
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

const scopeLabel = (stage, name) => `${stage} (${name})`

const preSteps = (lineage, request) => [
  ...lineage.map(({ name, settings }) => ({ label: scopeLabel(PRE_REQUEST, name), script: settings.preScript })),
  { label: PRE_REQUEST, script: request.preScript },
].filter((step) => hasText(step.script))

const postSteps = (lineage, request) => [
  { label: POST_RESPONSE, script: request.postScript, assertions: request.assertions },
  ...[...lineage].reverse().map(({ name, settings }) => ({
    label: scopeLabel(POST_RESPONSE, name),
    script: settings.postScript,
    assertions: settings.assertions,
  })),
].filter((step) => hasText(step.script) || countActiveAssertions(step.assertions) > 0)

const hasActiveInheritance = (lineage) => lineage.some(({ settings }) => hasActiveContent(settings))

async function resolveReferences(backend, request) {
  const targets = referenceTargets(store(), request)
  if (Object.keys(targets).length === 0) return {}
  if (!backend.secrets) throw new Error(SECRETS_TEXT.desktopOnly)
  return backend.secrets.resolve(targets)
}

const REQUIRE_CALL = 'require('

async function loadModules(backend, steps) {
  if (!backend.storage?.scriptModules || !steps.some((step) => step.script?.includes(REQUIRE_CALL))) return {}
  try {
    return await backend.storage.scriptModules()
  } catch {
    return {}
  }
}

function transportFor(backend, request) {
  if (isGrpcRequest(request)) return backend.invokeGrpc
  if (isMcpRequest(request)) return backend.invokeMcp
  if (isStreamRequest(request)) return transmitStream(backend)
  return backend.send
}

async function renewAuth(backend, request, lineage, variables) {
  const source = inheritedAuthSource(request.auth, lineage)
  if (!source) {
    const renewed = await withFreshToken(backend, request, variables)
    return { request: renewed, outgoing: renewed }
  }
  const outgoing = await withFreshToken(backend, { ...request, auth: source.settings.auth }, variables)
  if (outgoing.auth !== source.settings.auth) store().updateScopeSettings(source.id, { auth: outgoing.auth })
  return { request, outgoing }
}

let scriptSends = 0
let consoleSequence = 0

function createScriptSender(backend, trace) {
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
    if (!isPermittedHost(host, scriptHosts())) {
      throw new Error(`The host "${host}" is not used by this collection, so scripts may not call it.`)
    }
    scriptSends += 1
    const sendId = `script-${scriptSends}`
    const transmit = () => transportFor(backend, timed)(sendId, timed, variables, store().cookies)
    const response = await trace.timed(exchangeEntry(ENTRY_KINDS.SEND, timed), transmit)
    if (response.error) throw new Error(response.body)
    return JSON.stringify(responseSubject(response))
  }
}

export function createExecutor(backend) {
  const perform = async (original, sendId, runs, trace) => {
    const stop = (request, message) => ({
      auth: request.auth,
      response: failureResponse(CONFIG_ERROR, message),
      tests: report(runs),
      extraction: null,
    })

    const lineage = lineageOf(store(), original.folderId)
    let request = original
    if (store().isRestricted && (hasActiveContent(request) || hasActiveInheritance(lineage))) return stop(request, RESTRICTED)

    let referenced
    try {
      referenced = await resolveReferences(backend, request)
    } catch (error) {
      return stop(request, error.message)
    }
    const variablesOf = (candidate, answers) => variablesText(candidate, answers, referenced)
    const context = { send: createScriptSender(backend, trace), trace, referenced }

    const modules = await loadModules(backend, [...preSteps(lineage, request), ...postSteps(lineage, request)])

    for (const step of preSteps(lineage, request)) {
      const pre = await runStage(step.label, { script: step.script, request: requestSubject(request), modules }, request, context)
      runs.push(pre)
      if (pre.error) return stop(request, pre.error)
      if (holdsBack(pre.flow)) return { ...stop(request, reasonFor(pre.flow)), skipped: reasonFor(pre.flow) }
      request = applyRequestEdits(request, pre.request)
    }

    const answers = await askForValues(request, referenced)
    if (answers === null) return stop(request, PROMPT_DECLINED)

    let renewal
    try {
      renewal = await renewAuth(backend, request, lineage, variablesOf(request, answers))
    } catch (error) {
      return stop(request, error.message)
    }
    request = renewal.request
    const { outgoing } = renewal

    if (isLocalCommand(outgoing) && needsApproval(backend, outgoing, variablesOf(request, answers))) return stop(request, LOCAL_COMMAND_TEXT.notApproved)

    const transmit = () => transportFor(backend, outgoing)(sendId, withInheritance(store(), outgoing), variablesOf(request, answers), store().cookies)
    const response = await trace.timed(exchangeEntry(ENTRY_KINDS.REQUEST, outgoing), transmit)
    store().storeCookies(response.cookies || [])
    const extraction = applyExtractors(request, response)

    if (isUsableResponse(response)) {
      for (const step of postSteps(lineage, request)) {
        runs.push(await runStage(step.label, {
          script: step.script,
          assertions: step.assertions,
          request: requestSubject(request),
          response: responseSubject(response),
          modules,
        }, request, context))
      }
    }
    return { auth: request.auth, response, tests: report(runs), extraction }
  }

  return async function execute(original, sendId) {
    const runs = []
    const trace = createTrace()
    const outcome = await perform(original, sendId, runs, trace)
    const logs = runs.flatMap((run) => run.logs)
    if (logs.length > 0) store().appendConsole(consoleGroup(original, logs, ++consoleSequence))
    return { ...outcome, response: withActivity(outcome.response, trace.entries) }
  }
}
