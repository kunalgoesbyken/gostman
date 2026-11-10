import catalogue from '../../../../engine/variables.json'
import { argumentOf, isEncodedName, isEncoderBase, splitCall } from './callNames'

export { PROCESS_PREFIX } from './scripting/scopes'
export const PROMPT_PREFIX = '?'
export const DYNAMIC_PREFIX = '$'
export const FAKER_PREFIX = 'faker.'

const DESCRIPTIONS = new Map(catalogue.variables.map(({ name, description }) => [name, description]))
const FAKER_TARGETS = new Map(Object.entries(catalogue.fakerAliases))

export const DYNAMIC_VARIABLES = Array.from(DESCRIPTIONS.keys())

const FILE_CALL = /\$(?:file|fileBase64|template)\(/u
const FILE_FUNCTIONS = new Set(['$file', '$fileBase64', '$template'])
function callForms() {
  const forms = new Map()
  for (const name of DESCRIPTIONS.keys()) {
    const call = splitCall(name)
    if (call) forms.set(call.base, [...(forms.get(call.base) ?? []), name])
  }
  return forms
}

const CALL_FORMS = callForms()

const fakerCallForms = ([alias, target]) => (CALL_FORMS.get(target) ?? []).map((form) => alias + form.slice(target.length))

export const FAKER_VARIABLES = [...FAKER_TARGETS.keys(), ...Array.from(FAKER_TARGETS, fakerCallForms).flat()]

function templateOf(name) {
  const call = splitCall(name)
  if (!call) return FAKER_TARGETS.get(name) || name
  const target = FAKER_TARGETS.get(call.base) || call.base
  const exact = target + call.tail
  return DESCRIPTIONS.has(exact) ? exact : CALL_FORMS.get(target)?.[0] ?? name
}

function readPathOf(name) {
  const call = splitCall(name.trim())
  if (!call) return null
  if (FILE_FUNCTIONS.has(call.base)) return argumentOf(call)
  return isEncoderBase(call.base) ? readPathOf(argumentOf(call)) : null
}

export const isFileName = (name) => readPathOf(name) !== null

export const callsFile = (text) => FILE_CALL.test(text)

export const filePathOf = (name) => readPathOf(name) ?? ''

export const isDynamicName = (name) => DESCRIPTIONS.has(templateOf(name))

export const isGeneratedName = (name) => isDynamicName(name) && !isFileName(name) && !isEncodedName(name)

export const describeDynamic = (name) => DESCRIPTIONS.get(templateOf(name)) || ''

export const isFakerQuery = (query) => query.startsWith(DYNAMIC_PREFIX + FAKER_PREFIX) || query.startsWith(FAKER_PREFIX)

export const isPromptName = (name) => name.startsWith(PROMPT_PREFIX) && name.length > PROMPT_PREFIX.length

export const isEngineName = (name) => isDynamicName(name) || isPromptName(name)
