import { SCOPE_COLLECTION, SCOPE_ENVIRONMENT, SCOPE_GLOBAL, SCOPE_SESSION } from './scopes'

const VARIABLE_FAMILIES = { Var: SCOPE_SESSION, EnvVar: SCOPE_ENVIRONMENT, GlobalEnvVar: SCOPE_GLOBAL, CollectionVar: SCOPE_COLLECTION }
const PATH_SEPARATOR = '/'

const brunoResponse = (response) => ({ ...response, data: response.body })

const brunoTarget = (options) => (
  typeof options === 'string'
    ? options
    : { url: options.url, method: options.method, headers: options.headers, body: options.data, timeout: options.timeout }
)

const savedName = (path) => String(path).split(PATH_SEPARATOR).pop()

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const variableCalls = (scopes) => Object.fromEntries(Object.entries(VARIABLE_FAMILIES).flatMap(([family, scope]) => [
  [`get${family}`, scopes[scope].get],
  [`set${family}`, scopes[scope].set],
  [`has${family}`, scopes[scope].has],
  [`delete${family}`, scopes[scope].unset],
  [`getAll${family}s`, scopes[scope].all],
  [`deleteAll${family}s`, scopes[scope].clear],
]))

const iterationData = (environment) => ({
  get: (name) => (name === undefined ? environment.all() : environment.get(name)),
  has: environment.has,
  unset: environment.unset,
  stringify: () => JSON.stringify(environment.all()),
})

export function createBruno({ scopes, environmentName, flow, request, cookies, sendRequest, respond }) {
  const environment = scopes[SCOPE_ENVIRONMENT]
  const send = (options, callback) => respond(sendRequest(brunoTarget(options)).then(brunoResponse), callback)
  return {
    ...variableCalls(scopes),
    getFolderVar: environment.get,
    getRequestVar: environment.get,
    getProcessEnv: environment.get,
    getEnvName: () => environmentName,
    getRequestName: () => request.name,
    interpolate: environment.interpolate,
    isSafeMode: () => true,
    cookies,
    sleep: pause,
    sendRequest: send,
    runRequest: (path) => sendRequest(savedName(path)).then(brunoResponse),
    setNextRequest: flow.setNextRequest,
    runner: { ...flow, iterationData: iterationData(environment) },
  }
}
