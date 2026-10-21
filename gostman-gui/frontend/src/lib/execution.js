import { hasActiveContent } from './activeContent'
import { extractVariables, isUsableResponse, parseExtractors } from './chaining'
import { isPlainObject, parseJSON } from './dataUtils'
import { isGrpcRequest } from './grpc'
import { inheritedAuthSource, lineageOf, withInheritance } from './inheritance'
import { isMcpRequest } from './mcp'
import { withFreshToken } from './oauth'
import { failureResponse } from './response'
import { countActiveAssertions } from './scripting/assertions'
import { applyRequestEdits, requestSubject, responseSubject, runInSandbox } from './scripting/sandbox'
import { promptNames } from './variableScopes'
import { useAppStore, variableTextFor } from '../store/appStore'

const CONFIG_ERROR = 'config'
const PROMPT_DECLINED = 'The request was not sent because the values it asks for were not provided.'
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

async function runStage(stage, job, request) {
  const variables = readVariables(request)
  const run = await runInSandbox({ ...job, variables })
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

const report = (runs) => ({
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

function transportFor(backend, request) {
  if (isGrpcRequest(request)) return backend.invokeGrpc
  if (isMcpRequest(request)) return backend.invokeMcp
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

export function createExecutor(backend) {
  return async function execute(original, sendId) {
    const runs = []
    const stop = (request, message) => ({
      auth: request.auth,
      response: failureResponse(CONFIG_ERROR, message),
      tests: report(runs),
      extraction: null,
    })

    const lineage = lineageOf(store(), original.folderId)
    let request = original
    if (store().isRestricted && (hasActiveContent(request) || hasActiveInheritance(lineage))) return stop(request, RESTRICTED)
    for (const step of preSteps(lineage, request)) {
      const pre = await runStage(step.label, { script: step.script, request: requestSubject(request) }, request)
      runs.push(pre)
      if (pre.error) return stop(request, pre.error)
      request = applyRequestEdits(request, pre.request)
    }

    const answers = await askForValues(request)
    if (answers === null) return stop(request, PROMPT_DECLINED)

    let renewal
    try {
      renewal = await renewAuth(backend, request, lineage, variablesText(request, answers))
    } catch (error) {
      return stop(request, error.message)
    }
    request = renewal.request
    const { outgoing } = renewal

    const transmit = transportFor(backend, outgoing)
    const response = await transmit(sendId, withInheritance(store(), outgoing), variablesText(request, answers), store().cookies)
    store().storeCookies(response.cookies || [])
    const extraction = applyExtractors(request, response)

    if (isUsableResponse(response)) {
      for (const step of postSteps(lineage, request)) {
        runs.push(await runStage(step.label, {
          script: step.script,
          assertions: step.assertions,
          request: requestSubject(request),
          response: responseSubject(response),
        }, request))
      }
    }
    return { auth: request.auth, response, tests: report(runs), extraction }
  }
}
