import { JSONPath } from 'jsonpath-plus'
import { JSON_PATH_TEXT } from './checksText'

const SafeScript = JSONPath.prototype.safeVm.Script
const BLOCKED_NAMES = new Set(['constructor', 'prototype', 'call', 'apply', 'bind'])
const INTERNAL_PREFIX = '__'
const MEMBER = 'MemberExpression'
const LITERAL = 'Literal'

const isBlocked = (name) => name.startsWith(INTERNAL_PREFIX) || BLOCKED_NAMES.has(name)

function memberName(node) {
  if (!node.computed) return node.property.name
  return node.property.type === LITERAL ? String(node.property.value) : ''
}

function guard(node) {
  if (Array.isArray(node)) {
    node.forEach(guard)
    return
  }
  if (node === null || typeof node !== 'object') return
  if (node.type === MEMBER) {
    const name = memberName(node)
    if (name === '' || isBlocked(name)) throw new Error(JSON_PATH_TEXT.blocked(name))
  }
  Object.values(node).forEach(guard)
}

class GuardedScript extends SafeScript {
  constructor(expression) {
    super(expression)
    guard(this.ast)
  }

  runInNewContext(context) {
    return super.runInNewContext(context)
  }
}

export const queryJson = (path, json) => JSONPath({ path, json, wrap: false, eval: GuardedScript })
