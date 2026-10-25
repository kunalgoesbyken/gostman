import catalogue from '../../../../engine/variables.json'

export { PROCESS_PREFIX } from './scripting/scopes'
export const PROMPT_PREFIX = '?'
export const DYNAMIC_PREFIX = '$'
export const FAKER_PREFIX = 'faker.'

const DESCRIPTIONS = new Map(catalogue.variables.map(({ name, description }) => [name, description]))
const FAKER_TARGETS = new Map(Object.entries(catalogue.fakerAliases))

export const DYNAMIC_VARIABLES = Array.from(DESCRIPTIONS.keys())
export const FAKER_VARIABLES = Array.from(FAKER_TARGETS.keys())

const DYNAMIC_RANGE = /^\$randomInt\(\s*-?\d+\s*,\s*-?\d+\s*\)$/u
const FILE_REFERENCE = /^\$file(Base64)?\((.*)\)$/u
const FILE_CALL = /\$file(?:Base64)?\(/u
const RANGE_TEMPLATE = '$randomInt(min,max)'
const FILE_TEMPLATE = '$file(path)'
const FILE_BASE64_TEMPLATE = '$fileBase64(path)'

function templateOf(name) {
  const file = FILE_REFERENCE.exec(name)
  if (file) return file[1] ? FILE_BASE64_TEMPLATE : FILE_TEMPLATE
  if (DYNAMIC_RANGE.test(name)) return RANGE_TEMPLATE
  return FAKER_TARGETS.get(name) || name
}

export const isFileName = (name) => FILE_REFERENCE.test(name)

export const callsFile = (text) => FILE_CALL.test(text)

export const filePathOf = (name) => FILE_REFERENCE.exec(name)?.[2].trim() || ''

export const isDynamicName = (name) => DESCRIPTIONS.has(templateOf(name))

export const describeDynamic = (name) => DESCRIPTIONS.get(templateOf(name)) || ''

export const isFakerQuery = (query) => query.startsWith(DYNAMIC_PREFIX + FAKER_PREFIX) || query.startsWith(FAKER_PREFIX)

export const isPromptName = (name) => name.startsWith(PROMPT_PREFIX) && name.length > PROMPT_PREFIX.length
