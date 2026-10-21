import { hasActiveContent } from './activeContent'
import { extractVariables, isUsableResponse, parseExtractors } from './chaining'
import { isPlainObject, parseJSON } from './dataUtils'
import { isGrpcRequest } from './grpc'
import { isMcpRequest } from './mcp'
import { withFreshToken } from './oauth'
import { failureResponse } from './response'
import { countActiveAssertions } from './scripting/assertions'
import { applyRequestEdits, requestSubject, responseSubject, runInSandbox } from './scripting/sandbox'
import { SECRETS_TEXT } from './secretsText'
import { promptNames, referenceTargets } from './variableScopes'
import { useAppStore, variableTextFor } from '../store/appStore'

const CONFIG_ERROR = 'config'
const PROMPT_DECLINED = 'The request was not sent because the values it asks for were not provided.'
const PRE_REQUEST = 'Pre-request script'
const POST_RESPONSE = 'Post-response script'
export const RESTRICTED = 'This folder is not trusted yet, so its scripts and OAuth 2.0 settings are switched off. Open the folder menu in the header and choose Trust this folder.'

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

async function runStage(stage, job, request, referenced) {
  const variables = readVariables(request, referenced)
  const run = await runInSandbox({ ...job, variables })
  if (isPlainObject(run.variables) && !isSame(variables, run.variables)) {
    store().mergeActiveVariables(scriptChanges(variables, run.variables))
  }
  return { ...run, error: run.error ? `${stage}: ${run.error}` : '' }
}

async function askForValues(request, referenced) {
  const names = promptNames(request)
  if (names.length === 0) return {}
  const known = readVariables(request, referenced)
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

async function resolveReferences(backend, request) {
  const targets = referenceTargets(store(), request)
  if (Object.keys(targets).length === 0) return {}
  if (!backend.secrets) throw new Error(SECRETS_TEXT.desktopOnly)
  return backend.secrets.resolve(targets)
}

const needsPostStage = (request) => hasText(request.postScript) || countActiveAssertions(request.assertions) > 0

function transportFor(backend, request) {
  if (isGrpcRequest(request)) return backend.invokeGrpc
  if (isMcpRequest(request)) return backend.invokeMcp
  return backend.send
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

    let request = original
    if (store().isRestricted && hasActiveContent(request)) return stop(request, RESTRICTED)

    let referenced
    try {
      referenced = await resolveReferences(backend, request)
    } catch (error) {
      return stop(request, error.message)
    }
    const variablesOf = (candidate, answers) => variablesText(candidate, answers, referenced)

    if (hasText(request.preScript)) {
      const pre = await runStage(PRE_REQUEST, { script: request.preScript, request: requestSubject(request) }, request, referenced)
      runs.push(pre)
      if (pre.error) return stop(request, pre.error)
      request = applyRequestEdits(request, pre.request)
    }

    const answers = await askForValues(request, referenced)
    if (answers === null) return stop(request, PROMPT_DECLINED)

    try {
      request = await withFreshToken(backend, request, variablesOf(request, answers))
    } catch (error) {
      return stop(request, error.message)
    }

    const transmit = transportFor(backend, request)
    const response = await transmit(sendId, request, variablesOf(request, answers), store().cookies)
    store().storeCookies(response.cookies || [])
    const extraction = applyExtractors(request, response)

    if (isUsableResponse(response) && needsPostStage(request)) {
      runs.push(await runStage(POST_RESPONSE, {
        script: request.postScript,
        assertions: request.assertions,
        request: requestSubject(request),
        response: responseSubject(response),
      }, request, referenced))
    }
    return { auth: request.auth, response, tests: report(runs), extraction }
  }
}
