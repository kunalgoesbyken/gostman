import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { LOCALES_ROOT } from './paths.js'
import { ENGLISH, PLURAL_SUFFIX, languageDirectories, namespaceFiles } from './validate.js'

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

const writeJson = (file, tree) => writeFileSync(file, `${JSON.stringify(tree, null, 2)}\n`)

const pluralName = (key) => key.replace(PLURAL_SUFFIX, '')

const knownInEnglish = (english, key, value) => {
  if (isObject(value)) return isObject(english?.[key])
  if (!isObject(english)) return false
  const name = pluralName(key)
  return Object.keys(english).some((candidate) => typeof english[candidate] === 'string' && pluralName(candidate) === name)
}

function pruned(tree, english, dropped, prefix) {
  const kept = {}
  Object.entries(tree).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${isObject(value) ? key : pluralName(key)}` : isObject(value) ? key : pluralName(key)
    if (!knownInEnglish(english, key, value) || dropped.has(path)) return
    if (!isObject(value)) kept[key] = value
    else {
      const inner = pruned(value, english[key], dropped, path)
      if (Object.keys(inner).length > 0) kept[key] = inner
    }
  })
  return kept
}

function pruneNotes(namespace, english) {
  const file = join(LOCALES_ROOT, '_notes', `${namespace}.json`)
  if (!existsSync(file)) return
  const notes = readJson(file)
  const known = Object.fromEntries(Object.entries(notes).filter(([key]) => hasPath(english, key.split('.'))))
  if (Object.keys(known).length !== Object.keys(notes).length) writeJson(file, known)
}

function hasPath(tree, path) {
  const [head, ...rest] = path
  if (!isObject(tree)) return false
  if (rest.length === 0) return head in tree || Object.keys(tree).some((key) => pluralName(key) === head)
  return hasPath(tree[head], rest)
}

function pruneLanguage(language, englishTrees, dropped) {
  namespaceFiles(join(LOCALES_ROOT, language)).forEach((namespace) => {
    const file = join(LOCALES_ROOT, language, `${namespace}.json`)
    const current = readJson(file)
    const next = englishTrees[namespace] ? pruned(current, englishTrees[namespace], dropped, namespace) : {}
    if (JSON.stringify(current) !== JSON.stringify(next)) writeJson(file, next)
  })
}

function droppedPaths(argv) {
  const paths = new Set()
  argv.forEach((argument, index) => {
    if (argument === '--drop' && argv[index + 1]) paths.add(argv[index + 1])
  })
  return paths
}

const englishTrees = Object.fromEntries(namespaceFiles(join(LOCALES_ROOT, ENGLISH)).map((namespace) => [namespace, readJson(join(LOCALES_ROOT, ENGLISH, `${namespace}.json`))]))
const dropped = droppedPaths(process.argv.slice(2))

languageDirectories(LOCALES_ROOT).filter((language) => language !== ENGLISH).forEach((language) => pruneLanguage(language, englishTrees, dropped))
Object.entries(englishTrees).forEach(([namespace, tree]) => pruneNotes(namespace, tree))
