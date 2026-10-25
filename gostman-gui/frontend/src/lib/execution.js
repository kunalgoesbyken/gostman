import { hasActiveContent } from './activeContent'
import { defaultExtractScope, enabledExtractors, isUsableResponse, parseExtractors, writesFrom } from './chaining'
import { isPlainObject, parseJSON } from './dataUtils'
import { isGrpcRequest } from './grpc'
import { inheritedAuthSource, layersOf, lineageOf, withInheritance } from './inheritance'
import { LOCAL_COMMAND_TEXT, needsApproval } from './localCommands'
import { isLocalCommand, isMcpRequest } from './mcp'
import { withFreshToken } from './oauth'
import { failureResponse } from './response'
import { isStreamRequest } from './sse'
import { transmitStream } from './sseTransport'
import { countActiveAssertions } from './scripting/assertions'
import { CHECK_RUN_TEXT } from './checksText'
import { consoleGroup } from './consoleLog'
import { createContractChecker, linkFor } from './contractCheck'
import { addressHost, collectionHostsBy, isPermittedHost } from './scripting/destinations'
import { holdsBack, reasonFor } from './scripting/flow'
import { MAX_SENDS, SEND_TIMEOUT_MS, extractAllowance } from './scripting/limits'
import { errorLine } from './scripting/console'
import { applyRequestEdits, extractInSandbox, requestSubject, responseSubject, runInSandbox } from './scripting/sandbox'
import { acceptedCookies, scriptCookies } from './scripting/scriptCookies'
import { scriptedRequest } from './scripting/subjects'
import { rememberResolved } from './resolvedSecrets'
import { SECRETS_TEXT } from './secretsText'
import { ENTRY_KINDS, exchangeEntry, scriptEntry, secretsEntry, withActivity } from './timeline'
import { promptNames, referenceTargets, usedVariableNames } from './variableScopes'
import { environmentFor, scriptLayersFor, useAppStore, variableTextFor } from '../store/appStore'

const CONFIG_ERROR = 'config'
const SCRIPT_ERROR = 'script'
export const RESTRICTED_ERROR = 'restricted'
const PROMPT_DECLINED = 'The request was not sent because the values it asks for were not provided.'
const UNUSABLE_ADDRESS = 'The address cannot be used by a script.'
const SEND_LIMIT = `A script may call sendRequest ${MAX_SENDS} times.`
const PRE_REQUEST = 'Pre-request script'
const POST_RESPONSE = 'Post-response script'
export const RESTRICTED = 'This folder is not trusted yet, so its scripts, OAuth 2.0 settings, local MCP commands and file reads are switched off. Open the folder menu in the header and choose Trust this folder.'

const store = () => useAppStore.getState()
const variablesText = (request, answers, referenced) => variableTextFor(store(), request, answers, referenced)
const hasText = (text) => text.trim() !== ''

function readVariables(request, referenced) {
  const parsed = parseJSON(variablesText(request, undefined, referenced), {})
  return isPlainObject(parsed) ? parsed : {}
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

async function runStage(stage, job, request, { send, trace, referenced, timeoutMs }) {
  const layers = scriptLayersFor(store(), request, referenced)
  const hosts = scriptHosts()
  const cookies = scriptCookies(store().cookies, hosts)
  const environment = environmentFor(store(), request)?.name ?? ''
  const run = await trace.timed(scriptEntry(stage), () => runInSandbox({ ...job, layers, cookies, environment }, send, timeoutMs))
  if (isPlainObject(run.writes)) store().applyVariableWrites(run.writes, request)
  const changed = acceptedCookies(run.cookies, hosts)
  if (changed.length > 0) store().storeCookies(changed)
  return { ...run, error: run.error ? `${stage}: ${run.error}` : '' }
}

const askNow = (request, referenced) => (names, isForRun) => {
  const known = readVariables(request, referenced)
  return store().askVariables(names, Object.fromEntries(names.map((name) => [name, known[name] ?? ''])), isForRun)
}

const askEveryTime = (names, ask) => ask(names, false)

export function rememberPrompts() {
  const values = {}
  let isDeclined = false
  let turn = Promise.resolve()

  const answer = async (names, ask) => {
    if (isDeclined) return null
    const missing = names.filter((name) => !Object.hasOwn(values, name))
    if (missing.length > 0) {
      const given = await ask(missing, true)
      if (given === null) {
        isDeclined = true
        return null
      }
      Object.assign(values, given)
    }
    return Object.fromEntries(names.map((name) => [name, values[name]]))
  }

  return (names, ask) => {
    const next = turn.then(() => answer(names, ask))
    turn = next.catch(() => undefined)
    return next
  }
}

async function askForValues(request, referenced, prompts) {
  const names = promptNames(request)
  if (names.length === 0) return {}
  return prompts(names, askNow(request, referenced))
}

const NO_FLOW = { action: '', target: '' }

const lastFlow = (runs) => runs.map((run) => run.flow).filter((flow) => flow?.action).pop() ?? NO_FLOW

const report = (runs) => ({
  flow: lastFlow(runs),
  visualization: runs.map((run) => run.visualization).filter(Boolean).pop() ?? '',
  results: runs.flatMap((run) => run.tests),
  logs: runs.flatMap((run) => run.logs),
  error: runs.map((run) => run.error).filter(Boolean).join('\n'),
  notes: runs.map((run) => run.note).filter(Boolean),
})

const scriptTimeoutOf = (request) => lineageOf(store(), request.folderId)[0]?.settings.scriptTimeoutMs

const NO_OUTCOMES = { outcomes: [] }

export async function applyExtractors(request, response) {
  const extractors = parseExtractors(request.extractors)
  if (extractors.length === 0 || !isUsableResponse(response)) return null
  const enabled = enabledExtractors(extractors)
  const evaluated = enabled.length > 0 ? await extractInSandbox(enabled, response, extractAllowance(scriptTimeoutOf(request))) : NO_OUTCOMES
  if (evaluated.error) return { error: evaluated.error }
  const writes = writesFrom(enabled, evaluated.outcomes, defaultExtractScope(store().workspaceStatus.path))
  return { saved: store().applyVariableWrites(writes, request), written: Object.fromEntries(Object.entries(writes).map(([scope, values]) => [scope, Object.keys(values)])) }
}

const extractionRun = (extraction) => ({ tests: [], logs: [errorLine(extraction.error)], error: extraction.error })

const scopeLabel = (stage, name) => `${stage} (${name})`

const preSteps = (lineage, request) => [
  ...lineage.map(({ name, settings }) => ({ label: scopeLabel(PRE_REQUEST, name), script: settings.preScript })),
  { label: PRE_REQUEST, script: request.preScript },
].filter((step) => hasText(step.script))

const postLabel = (script) => (hasText(script) ? POST_RESPONSE : CHECK_RUN_TEXT.stage)

const postSteps = (lineage, request) => [
  { label: postLabel(request.postScript), script: request.postScript, assertions: request.assertions },
  ...[...lineage].reverse().map(({ name, settings }) => ({
    label: scopeLabel(postLabel(settings.postScript), name),
    script: settings.postScript,
    assertions: settings.assertions,
  })),
].filter((step) => hasText(step.script) || countActiveAssertions(step.assertions) > 0)

const hasActiveInheritance = (lineage) => lineage.some(({ settings }) => hasActiveContent(settings))

const runsScripts = (lineage, request) => [...preSteps(lineage, request), ...postSteps(lineage, request)].some((step) => hasText(step.script))

const namesInUse = (lineage, request) => (
  runsScripts(lineage, request) ? undefined : usedVariableNames([request, lineage.map(({ settings }) => settings)])
)

async function resolveReferences(backend, request, lineage, trace) {
  const targets = referenceTargets(store(), request, namesInUse(lineage, request))
  if (Object.keys(targets).length === 0) return {}
  if (!backend.secrets) throw new Error(SECRETS_TEXT.desktopOnly)
  const resolved = await trace.timed(secretsEntry(targets), () => backend.secrets.resolve(targets))
  rememberResolved(resolved)
  return resolved
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
  const environmentId = environmentFor(store(), request)?.id || ''
  if (!source) {
    const renewed = await withFreshToken(backend, request, variables, environmentId)
    return { request: renewed, outgoing: renewed }
  }
  const outgoing = await withFreshToken(backend, { ...request, auth: source.settings.auth }, variables, environmentId)
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
  const checkContract = createContractChecker(backend)

  const perform = async (original, sendId, runs, trace, prompts) => {
    const stop = (request, message, kind = CONFIG_ERROR) => ({
      auth: request.auth,
      response: failureResponse(kind, message),
      tests: report(runs),
      extraction: null,
    })

    const lineage = lineageOf(store(), original.folderId)
    let request = original
    if (store().isRestricted && (hasActiveContent(request) || hasActiveInheritance(lineage))) return stop(request, RESTRICTED, RESTRICTED_ERROR)

    let referenced
    try {
      referenced = await resolveReferences(backend, request, lineage, trace)
    } catch (error) {
      return stop(request, error.message)
    }
    const variablesOf = (candidate, answers) => variablesText(candidate, answers, referenced)
    const context = { send: createScriptSender(backend, trace), trace, referenced, timeoutMs: lineage[0]?.settings.scriptTimeoutMs }

    const inherited = layersOf(lineage)
    const modules = await loadModules(backend, [...preSteps(lineage, request), ...postSteps(lineage, request)])

    for (const step of preSteps(lineage, request)) {
      const pre = await runStage(step.label, { script: step.script, request: requestSubject(request, inherited), modules }, request, context)
      runs.push(pre)
      if (pre.error) return stop(request, pre.error, SCRIPT_ERROR)
      if (holdsBack(pre.flow)) return { ...stop(request, reasonFor(pre.flow)), skipped: reasonFor(pre.flow) }
      request = applyRequestEdits(request, pre.request, inherited)
    }

    const answers = await askForValues(request, referenced, prompts)
    if (answers === null) return stop(request, PROMPT_DECLINED)

    let renewal
    try {
      renewal = await renewAuth(backend, request, lineage, variablesOf(request, answers))
    } catch (error) {
      return stop(request, error.message)
    }
    request = renewal.request
    const { outgoing } = renewal

    if (isLocalCommand(outgoing) && needsApproval(backend, outgoing, variablesText(outgoing))) return stop(request, LOCAL_COMMAND_TEXT.notApproved)

    const transmit = () => transportFor(backend, outgoing)(sendId, withInheritance(store(), outgoing), variablesOf(request, answers), store().cookies)
    const response = await trace.timed(exchangeEntry(ENTRY_KINDS.REQUEST, outgoing), transmit)
    if (!outgoing.options?.discardCookies) store().storeCookies(response.cookies || [])
    const extraction = await applyExtractors(request, response)
    if (extraction?.error) runs.push(extractionRun(extraction))

    if (isUsableResponse(response)) {
      for (const step of postSteps(lineage, request)) {
        runs.push(await runStage(step.label, {
          script: step.script,
          assertions: step.assertions,
          request: requestSubject(request, inherited),
          response: responseSubject(response),
          modules,
        }, request, context))
      }
      runs.push(await checkContract(linkFor(store().specLinks, lineage), request, response))
    }
    return { auth: request.auth, response, tests: report(runs), extraction }
  }

  return async function execute(original, sendId, prompts = askEveryTime) {
    const runs = []
    const trace = createTrace()
    const outcome = await perform(original, sendId, runs, trace, prompts)
    const logs = runs.flatMap((run) => run.logs)
    if (logs.length > 0) store().appendConsole(consoleGroup(original, logs, ++consoleSequence))
    return { ...outcome, response: withActivity(outcome.response, trace.entries) }
  }
}
