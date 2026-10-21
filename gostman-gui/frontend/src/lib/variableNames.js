export const PROCESS_PREFIX = 'process.env.'
export const PROMPT_PREFIX = '?'
export const DYNAMIC_PREFIX = '$'

export const DYNAMIC_VARIABLES = [
  '$guid', '$uuid', '$timestamp', '$timestampMs', '$isoTimestamp', '$randomInt', '$randomInt(min,max)', '$randomBoolean',
  '$randomHex', '$randomAlphaNumeric', '$randomFirstName', '$randomLastName', '$randomFullName', '$randomUserName',
  '$randomEmail', '$randomWord', '$randomIP', '$randomColor',
]

export const SOURCE_LABELS = {
  global: 'Global',
  collection: 'Collection',
  environment: 'Environment',
  folder: 'Folder',
  request: 'Request',
  process: '.env file',
}

const DYNAMIC_RANGE = /^\$randomInt\(\s*-?\d+\s*,\s*-?\d+\s*\)$/u

export const isDynamicName = (name) => DYNAMIC_VARIABLES.includes(name) || DYNAMIC_RANGE.test(name)

export const isPromptName = (name) => name.startsWith(PROMPT_PREFIX) && name.length > PROMPT_PREFIX.length
