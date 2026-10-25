import { parse } from '@babel/parser'

const TEXT_MODULE = /Text(\.js)?$/
const EAGER_METHODS = new Set(['map', 'forEach', 'filter', 'flatMap', 'reduce', 'reduceRight', 'some', 'every', 'find', 'findIndex', 'findLast', 'findLastIndex', 'sort', 'toSorted', 'from', 'fromEntries'])
const SKIPPED_KEYS = new Set(['loc', 'start', 'end', 'extra', 'leadingComments', 'trailingComments', 'innerComments', 'range', 'errors', 'tokens'])
const IGNORED_TYPES = new Set(['ImportDeclaration', 'ExportSpecifier'])
const DEFERRED_TYPES = new Set([
  'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ObjectMethod', 'ClassMethod', 'ClassPrivateMethod', 'ClassBody',
])

const isNode = (value) => value !== null && typeof value === 'object' && typeof value.type === 'string'

function* childNodes(node) {
  for (const [key, value] of Object.entries(node)) {
    if (SKIPPED_KEYS.has(key)) continue
    if (Array.isArray(value)) yield* value.filter(isNode).map((child) => [key, child])
    else if (isNode(value)) yield [key, value]
  }
}

function rootOf(expression) {
  let current = expression
  while (current.type === 'MemberExpression' || current.type === 'OptionalMemberExpression') {
    if (current.computed && current.property.type !== 'StringLiteral' && current.property.type !== 'NumericLiteral') return null
    current = current.object
  }
  return current.type === 'Identifier' ? current.name : null
}

function boundNames(pattern) {
  if (pattern.type === 'Identifier') return [pattern.name]
  if (pattern.type === 'ObjectPattern') return pattern.properties.flatMap((property) => boundNames(property.type === 'RestElement' ? property.argument : property.value))
  if (pattern.type === 'AssignmentPattern') return boundNames(pattern.left)
  return []
}

function importedTextBindings(program) {
  return program.body
    .filter((statement) => statement.type === 'ImportDeclaration' && TEXT_MODULE.test(statement.source.value))
    .flatMap((statement) => statement.specifiers.map((specifier) => specifier.local.name))
}

function isAliasDeclarator(declarator, tracked) {
  if (!declarator.init) return false
  const root = rootOf(declarator.init)
  if (root === null || !tracked.has(root)) return false
  return declarator.id.type === 'Identifier' || declarator.id.type === 'ObjectPattern'
}

function trackedBindings(program) {
  const tracked = new Set(importedTextBindings(program))
  const declarators = program.body
    .filter((statement) => statement.type === 'VariableDeclaration')
    .flatMap((statement) => statement.declarations)
  let grew = true
  while (grew) {
    grew = false
    declarators.filter((declarator) => isAliasDeclarator(declarator, tracked)).forEach((declarator) => {
      boundNames(declarator.id).forEach((name) => {
        if (!tracked.has(name)) {
          tracked.add(name)
          grew = true
        }
      })
    })
  }
  return tracked
}

const isIntlConstruction = (node) => node.type === 'NewExpression' && node.callee.type === 'MemberExpression' && node.callee.object.type === 'Identifier' && node.callee.object.name === 'Intl'

const isLocaleCall = (node) => node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.name?.startsWith('toLocale')

function describe(node, tracked) {
  if (node.type === 'Identifier' && tracked.has(node.name)) return `${node.name} is read while the module evaluates; read it inside a function or alias the group.`
  if (isIntlConstruction(node)) return 'An Intl formatter is created while the module evaluates; create it inside a function.'
  if (isLocaleCall(node)) return `${node.callee.property.name} runs while the module evaluates; call it inside a function.`
  return null
}

function isSkippedReference(parent, key) {
  if (!parent) return false
  if ((parent.type === 'MemberExpression' || parent.type === 'OptionalMemberExpression') && key === 'property' && !parent.computed) return true
  if ((parent.type === 'ObjectProperty' || parent.type === 'ClassProperty') && key === 'key' && !parent.computed) return true
  return false
}

const isFunction = (node) => node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression'

function isEagerCall(node) {
  if (node.type !== 'CallExpression' && node.type !== 'OptionalCallExpression') return false
  if (isFunction(node.callee)) return true
  const callee = node.callee
  return (callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression') && !callee.computed && EAGER_METHODS.has(callee.property.name)
}

function findings(program, tracked) {
  const found = []
  const eagerCallbacks = new Set()
  const visit = (node, parent, key) => {
    if (isFunction(node) && eagerCallbacks.has(node)) {
      visit(node.body, node, 'body')
      return
    }
    if (IGNORED_TYPES.has(node.type) || DEFERRED_TYPES.has(node.type)) return
    if (isEagerCall(node)) {
      if (isFunction(node.callee)) eagerCallbacks.add(node.callee)
      node.arguments.filter(isFunction).forEach((argument) => eagerCallbacks.add(argument))
    }
    if (isSkippedReference(parent, key) || (parent?.type === 'VariableDeclarator' && key === 'id')) return
    const message = describe(node, tracked)
    if (message) found.push({ node, message })
    if (node.type === 'VariableDeclarator' && parent && parent.type === 'VariableDeclaration' && isAliasDeclarator(node, tracked) && program.body.includes(parent)) return
    for (const [childKey, child] of childNodes(node)) visit(child, node, childKey)
  }
  program.body.forEach((statement) => visit(statement, program, 'body'))
  return found
}

export function findCaptures(source, file) {
  let ast
  try {
    ast = parse(source, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true })
  } catch {
    return []
  }
  const tracked = trackedBindings(ast.program)
  return findings(ast.program, tracked).map(({ node, message }) => `${file}:${node.loc.start.line}:${node.loc.start.column + 1} ${message}`)
}
