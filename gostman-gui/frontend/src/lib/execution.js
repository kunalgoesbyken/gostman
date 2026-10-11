import { extractVariables, isUsableResponse, parseExtractors } from './chaining'
import { isPlainObject, parseJSON } from './dataUtils'
import { isGrpcRequest } from './grpc'
import { withFreshToken } from './oauth'
import { AUTH_OAUTH2 } from './request'
import { failureResponse } from './response'
import { countActiveAssertions } from './scripting/assertions'
import { applyRequestEdits, requestSubject, responseSubject, runInSandbox } from './scripting/sandbox'
import { selectActiveVariables, useAppStore } from '../store/appStore'

const CONFIG_ERROR = 'config'
const PRE_REQUEST = 'Pre-request script'
const POST_RESPONSE = 'Post-response script'
const RESTRICTED = 'This folder is not trusted yet, so its scripts and OAuth 2.0 settings are switched off. Open the folder menu in the header and choose Trust this folder.'

const store = () => useAppStore.getState()
const variablesText = () => selectActiveVariables(store())
const hasText = (text) => text.trim() !== ''
const isSame = (first, second) => JSON.stringify(first) === JSON.stringify(second)

function readVariables() {
  const parsed = parseJSON(variablesText(), {})
  return isPlainObject(parsed) ? parsed : null
}

async function runStage(stage, job) {
  const variables = readVariables()
  const run = await runInSandbox({ ...job, variables: variables || {} })
  if (variables && isPlainObject(run.variables) && !isSame(variables, run.variables)) {
    store().setActiveVariables(JSON.stringify(run.variables, null, 2))
  }
  return { ...run, error: run.error ? `${stage}: ${run.error}` : '' }
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

const usesActiveContent = (request) => (
  hasText(request.preScript) || hasText(request.postScript) || request.auth.type === AUTH_OAUTH2
)

const needsPostStage = (request) => hasText(request.postScript) || countActiveAssertions(request.assertions) > 0

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
    if (store().isRestricted && usesActiveContent(request)) return stop(request, RESTRICTED)
    if (hasText(request.preScript)) {
      const pre = await runStage(PRE_REQUEST, { script: request.preScript, request: requestSubject(request) })
      runs.push(pre)
      if (pre.error) return stop(request, pre.error)
      request = applyRequestEdits(request, pre.request)
    }

    try {
      request = await withFreshToken(backend, request, variablesText())
    } catch (error) {
      return stop(request, error.message)
    }

    const transmit = isGrpcRequest(request) ? backend.invokeGrpc : backend.send
    const response = await transmit(sendId, request, variablesText(), store().cookies)
    store().storeCookies(response.cookies || [])
    const extraction = applyExtractors(request, response)

    if (isUsableResponse(response) && needsPostStage(request)) {
      runs.push(await runStage(POST_RESPONSE, {
        script: request.postScript,
        assertions: request.assertions,
        request: requestSubject(request),
        response: responseSubject(response),
      }))
    }
    return { auth: request.auth, response, tests: report(runs), extraction }
  }
}
