import { assert, expect } from 'chai'
import { MAX_MODULE_BYTES, MAX_MODULE_DEPTH, MAX_MODULE_FILES } from '../limits'
import { createAjv } from './ajv'
import { createCryptoJs } from './cryptoJs'
import { createLodash } from './lodash'
import { createTimeLibrary } from './moment'
import { createUuid } from './uuid'

const PlainFunction = (() => {}).constructor
const LOCAL_EXTENSIONS = ['', '.js', '.json']

const BUNDLED = {
  lodash: createLodash,
  'crypto-js': createCryptoJs,
  uuid: createUuid,
  moment: () => createTimeLibrary({ mutable: true }),
  dayjs: () => createTimeLibrary({ mutable: false }),
  ajv: () => {
    const Ajv = createAjv()
    Ajv.default = Ajv
    return Ajv
  },
  chai: () => ({ expect, assert }),
}

export const MODULE_NAMES = Object.keys(BUNDLED)

const missing = (specifier) => new Error(`Cannot find module "${specifier}". Available modules: ${MODULE_NAMES.join(', ')}. Local files need a trusted folder in the desktop app.`)

const escapes = (specifier) => new Error(`"${specifier}" is outside the collection folder.`)

const isLocal = (specifier) => specifier.startsWith('./') || specifier.startsWith('../')

function resolvePath(directory, specifier) {
  const segments = directory === '' ? [] : directory.split('/')
  for (const part of specifier.split('/')) {
    if (part === '' || part === '.') continue
    if (part !== '..') segments.push(part)
    else if (segments.length === 0) throw escapes(specifier)
    else segments.pop()
  }
  return segments.join('/')
}

const directoryOf = (path) => path.slice(0, Math.max(path.lastIndexOf('/'), 0))

function checkBudget(files) {
  const names = Object.keys(files)
  const bytes = names.reduce((total, name) => total + String(files[name]).length, 0)
  if (names.length > MAX_MODULE_FILES || bytes > MAX_MODULE_BYTES) {
    throw new Error(`Local modules are limited to ${MAX_MODULE_FILES} files and ${MAX_MODULE_BYTES / 1000} KB.`)
  }
}

export function createRequire(files = {}) {
  const bundled = new Map()
  const loaded = new Map()
  let checked = false

  const bundledModule = (name) => {
    if (!bundled.has(name)) bundled.set(name, BUNDLED[name]())
    return bundled.get(name)
  }

  const findFile = (base) => LOCAL_EXTENSIONS.flatMap((extension) => [base + extension, `${base}/index${extension}`]).find((candidate) => Object.hasOwn(files, candidate))

  function execute(path, depth) {
    if (loaded.has(path)) return loaded.get(path).exports
    if (depth > MAX_MODULE_DEPTH) throw new Error('Local modules require each other too deeply.')
    const record = { exports: {} }
    loaded.set(path, record)
    if (path.endsWith('.json')) {
      record.exports = JSON.parse(files[path])
      return record.exports
    }
    const run = new PlainFunction('module', 'exports', 'require', files[path])
    run(record, record.exports, requireFrom(directoryOf(path), depth + 1))
    return record.exports
  }

  const requireFrom = (directory, depth) => (specifier) => {
    if (typeof specifier !== 'string') throw new TypeError('require needs a module name.')
    if (Object.hasOwn(BUNDLED, specifier)) return bundledModule(specifier)
    if (!isLocal(specifier)) throw missing(specifier)
    if (!checked) {
      checkBudget(files)
      checked = true
    }
    const path = findFile(resolvePath(directory, specifier))
    if (path === undefined) throw missing(specifier)
    return execute(path, depth)
  }

  return requireFrom('', 0)
}
