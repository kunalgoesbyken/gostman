import { get } from './modules/lodash'

const STATUS_CLASSES = {
  info: [100, 199], success: [200, 299], redirection: [300, 399], clientError: [400, 499], serverError: [500, 599], error: [400, 599],
}
const STATUS_CODES = {
  ok: 200, accepted: 202, withoutContent: 204, badRequest: 400, unauthorised: 401, unauthorized: 401, forbidden: 403, notFound: 404, notAcceptable: 406, rateLimited: 429,
}
const NOT_A_RESPONSE = 'Only a response such as pm.response can be checked this way.'

const responses = new WeakSet()

export function markResponse(response) {
  responses.add(response)
  return response
}

function jsonOf(response) {
  try {
    return { value: response.json() }
  } catch {
    return null
  }
}

export function postmanAssertions({ Assertion }, utils) {
  const subject = (assertion) => utils.flag(assertion, 'object')

  const onResponse = (check, fallback) => function (...args) {
    const response = subject(this)
    if (responses.has(response)) return check.call(this, response, ...args)
    if (fallback) return fallback.apply(this, args)
    throw new Error(NOT_A_RESPONSE)
  }

  const property = (name, check) => {
    if (name in Assertion.prototype) Assertion.overwriteProperty(name, (base) => onResponse(check, base))
    else Assertion.addProperty(name, onResponse(check))
  }

  const method = (name, check) => {
    if (name in Assertion.prototype) Assertion.overwriteMethod(name, (base) => onResponse(check, base))
    else Assertion.addMethod(name, onResponse(check))
  }

  Object.entries(STATUS_CLASSES).forEach(([name, [low, high]]) => property(name, function (response) {
    const range = `${low}-${high}`
    this.assert(response.code >= low && response.code <= high, 'expected response code to be #{exp} but found #{act}', 'expected response code not to be #{exp} but found #{act}', range, response.code)
  }))

  Object.entries(STATUS_CODES).forEach(([name, code]) => property(name, function (response) {
    this.assert(response.code === code, 'expected response to have status code #{exp} but got #{act}', 'expected response to not have status code #{exp}', code, response.code)
  }))

  function hasBody(response) {
    this.assert(response.text() !== '', 'expected response to have content in body', 'expected response to not have content in body')
  }

  function isJson(response) {
    this.assert(jsonOf(response) !== null, 'expected response body to be valid JSON', 'expected response body not to be valid JSON')
  }

  property('withBody', hasBody)

  property('json', isJson)

  method('status', function (response, expected) {
    const actual = typeof expected === 'number' ? response.code : response.status
    this.assert(actual === expected, 'expected response to have status #{exp} but got #{act}', 'expected response to not have status #{exp}', expected, actual)
  })

  method('header', function (response, name, ...value) {
    if (value.length === 0) {
      this.assert(response.headers.has(name), "expected response to have header '#{exp}'", "expected response to not have header '#{exp}'", name)
      return
    }
    const actual = response.headers.get(name)
    this.assert(actual === value[0], `expected response header '${name}' to be #{exp} but got #{act}`, `expected response header '${name}' to not be #{exp}`, value[0], actual)
  })

  method('body', function (response, ...expected) {
    if (expected.length === 0) return hasBody.call(this, response)
    const text = response.text()
    const [wanted] = expected
    if (wanted instanceof RegExp) {
      this.assert(wanted.test(text), 'expected response body to match #{exp}', 'expected response body not to match #{exp}', wanted)
      return
    }
    const actual = typeof wanted === 'string' ? text : jsonOf(response)?.value
    this.assert(utils.eql(actual, wanted), 'expected response body to equal #{exp} but got #{act}', 'expected response body not to equal #{exp}', wanted, actual)
  })

  method('jsonBody', function (response, ...expected) {
    if (expected.length === 0) return isJson.call(this, response)
    const json = jsonOf(response)
    const [path, ...value] = expected
    const actual = json === null ? undefined : get(json.value, path)
    if (value.length === 0) {
      this.assert(actual !== undefined, `expected response body to have "${path}"`, `expected response body not to have "${path}"`)
      return
    }
    this.assert(utils.eql(actual, value[0]), `expected "${path}" in the response body to be #{exp} but got #{act}`, `expected "${path}" in the response body not to be #{exp}`, value[0], actual)
  })

  Assertion.overwriteMethod('jsonSchema', (base) => function (...args) {
    const response = subject(this)
    if (responses.has(response)) utils.flag(this, 'object', jsonOf(response)?.value)
    return base.apply(this, args)
  })
}
