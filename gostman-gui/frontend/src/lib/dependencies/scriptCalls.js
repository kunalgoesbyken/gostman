import { javascriptLanguage } from '@codemirror/lang-javascript'

export const CALL_WRITE = 'write'
export const CALL_READ = 'read'

const CALLS = {
  'env.set': CALL_WRITE,
  'env.session.set': CALL_WRITE,
  'env.collection.set': CALL_WRITE,
  'env.globals.set': CALL_WRITE,
  'env.get': CALL_READ,
  'env.has': CALL_READ,
  'env.session.get': CALL_READ,
  'env.collection.get': CALL_READ,
  'env.globals.get': CALL_READ,
  'pm.environment.set': CALL_WRITE,
  'pm.variables.set': CALL_WRITE,
  'pm.collectionVariables.set': CALL_WRITE,
  'pm.globals.set': CALL_WRITE,
  'pm.environment.get': CALL_READ,
  'pm.variables.get': CALL_READ,
  'pm.collectionVariables.get': CALL_READ,
  'pm.globals.get': CALL_READ,
  'insomnia.environment.set': CALL_WRITE,
  'insomnia.variables.set': CALL_WRITE,
  'insomnia.collectionVariables.set': CALL_WRITE,
  'insomnia.baseEnvironment.set': CALL_WRITE,
  'insomnia.globals.set': CALL_WRITE,
  'insomnia.environment.get': CALL_READ,
  'insomnia.variables.get': CALL_READ,
  'insomnia.collectionVariables.get': CALL_READ,
  'insomnia.baseEnvironment.get': CALL_READ,
  'insomnia.globals.get': CALL_READ,
  'bru.setVar': CALL_WRITE,
  'bru.setEnvVar': CALL_WRITE,
  'bru.setGlobalEnvVar': CALL_WRITE,
  'bru.setCollectionVar': CALL_WRITE,
  'bru.getVar': CALL_READ,
  'bru.getEnvVar': CALL_READ,
  'bru.getGlobalEnvVar': CALL_READ,
  'bru.getCollectionVar': CALL_READ,
}

const STRING_NODE = 'String'
const ARGUMENT_LIST_NODE = 'ArgList'
const CALL_NODE = 'CallExpression'
const QUOTE_LENGTH = 1

const textOf = (source, node) => source.slice(node.from, node.to)

const calleeName = (source, callee) => textOf(source, callee).split(/\s+/u).join('').replaceAll('?.', '.')

function firstStringArgument(source, call) {
  const list = call.getChild(ARGUMENT_LIST_NODE)
  const argument = list?.getChild(STRING_NODE)
  if (!argument) return null
  const literal = textOf(source, argument).slice(QUOTE_LENGTH, -QUOTE_LENGTH)
  return literal.includes('\\') ? null : literal
}

function callOf(source, node) {
  const kind = CALLS[calleeName(source, node.firstChild)]
  const name = kind ? firstStringArgument(source, node) : null
  return name ? { kind, name } : null
}

export function scriptCalls(source) {
  const calls = []
  javascriptLanguage.parser.parse(source).iterate({
    enter: (node) => {
      if (node.name !== CALL_NODE) return
      const call = callOf(source, node.node)
      if (call) calls.push(call)
    },
  })
  return calls
}
