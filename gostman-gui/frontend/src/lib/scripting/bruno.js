import { PROCESS_PREFIX, SCOPE_COLLECTION, SCOPE_ENVIRONMENT, SCOPE_GLOBAL, SCOPE_SESSION } from './scopes'

const VARIABLE_FAMILIES = { Var: SCOPE_SESSION, EnvVar: SCOPE_ENVIRONMENT, GlobalEnvVar: SCOPE_GLOBAL, CollectionVar: SCOPE_COLLECTION }
const PATH_SEPARATOR = '/'

const brunoResponse = (response) => ({ ...response, data: response.body })

const brunoTarget = (options) => (
  typeof options === 'string'
    ? options
    : { url: options.url, method: options.method, headers: options.headers, body: options.data, timeout: options.timeout }
)

const savedName = (path) => String(path).split(PATH_SEPARATOR).pop()

const processValue = (layered) => (name) => layered.get(PROCESS_PREFIX + name) ?? layered.get(name)

const environmentWrite = (scopes) => (name, value, options) => scopes[options?.persist ? SCOPE_ENVIRONMENT : SCOPE_SESSION].set(name, value)

const unsavedFirst = (scopes, read) => (name) => {
  const session = scopes[SCOPE_SESSION]
  return session.has(name) ? session[read](name) : scopes[SCOPE_ENVIRONMENT][read](name)
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const variableCalls = (scopes) => Object.fromEntries(Object.entries(VARIABLE_FAMILIES).flatMap(([family, scope]) => [
  [`get${family}`, scopes[scope].get],
  [`set${family}`, scopes[scope].set],
  [`has${family}`, scopes[scope].has],
  [`delete${family}`, scopes[scope].unset],
  [`getAll${family}s`, scopes[scope].all],
  [`deleteAll${family}s`, scopes[scope].clear],
]))

const iterationData = (layered, session) => ({
  get: (name) => (name === undefined ? layered.all() : layered.get(name)),
  has: layered.has,
  unset: session.unset,
  stringify: () => JSON.stringify(layered.all()),
})

export function createBruno({ scopes, environmentName, flow, request, cookies, sendRequest, respond }) {
  const { layered } = scopes
  const send = (options, callback) => respond(sendRequest(brunoTarget(options)).then(brunoResponse), callback)
  return {
    ...variableCalls(scopes),
    setEnvVar: environmentWrite(scopes),
    getEnvVar: unsavedFirst(scopes, 'get'),
    hasEnvVar: unsavedFirst(scopes, 'has'),
    getFolderVar: layered.get,
    getRequestVar: layered.get,
    getProcessEnv: processValue(layered),
    getEnvName: () => environmentName,
    getRequestName: () => request.name,
    interpolate: layered.interpolate,
    isSafeMode: () => true,
    cookies,
    sleep: pause,
    sendRequest: send,
    runRequest: (path) => sendRequest(savedName(path)).then(brunoResponse),
    setNextRequest: flow.setNextRequest,
    runner: { ...flow, iterationData: iterationData(layered, scopes[SCOPE_SESSION]) },
  }
}
