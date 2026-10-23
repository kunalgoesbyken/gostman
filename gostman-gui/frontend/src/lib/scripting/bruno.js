const VARIABLE_FAMILIES = ['Var', 'EnvVar', 'GlobalEnvVar', 'CollectionVar']
const PATH_SEPARATOR = '/'

const brunoResponse = (response) => ({ ...response, data: response.body })

const brunoTarget = (options) => (
  typeof options === 'string'
    ? options
    : { url: options.url, method: options.method, headers: options.headers, body: options.data, timeout: options.timeout }
)

const savedName = (path) => String(path).split(PATH_SEPARATOR).pop()

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const variableCalls = (environment) => Object.fromEntries(VARIABLE_FAMILIES.flatMap((family) => [
  [`get${family}`, environment.get],
  [`set${family}`, environment.set],
  [`has${family}`, environment.has],
  [`delete${family}`, environment.unset],
  [`getAll${family}s`, environment.all],
  [`deleteAll${family}s`, environment.clear],
]))

const iterationData = (environment) => ({
  get: (name) => (name === undefined ? environment.all() : environment.get(name)),
  has: environment.has,
  unset: environment.unset,
  stringify: () => JSON.stringify(environment.all()),
})

export function createBruno({ environment, flow, request, cookies, sendRequest }) {
  const send = (options, callback) => {
    const sent = sendRequest(brunoTarget(options)).then(brunoResponse)
    return typeof callback === 'function' ? sent.then((response) => callback(null, response), callback) : sent
  }
  return {
    ...variableCalls(environment),
    getFolderVar: environment.get,
    getRequestVar: environment.get,
    getProcessEnv: environment.get,
    getEnvName: () => environment.name,
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
