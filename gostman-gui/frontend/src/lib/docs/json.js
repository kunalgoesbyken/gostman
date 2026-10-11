const INDENT = '  '
const OPENERS = ['{', '[']
const CLOSERS = ['}', ']']
const TOKEN = /"(?:[^"\\]|\\.)*"|[{}[\],:]|[^\s{}[\],:"]+/g

const isValid = (text) => {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

function reindent(text) {
  const tokens = text.match(TOKEN) || []
  let depth = 0
  const lineBreak = () => `\n${INDENT.repeat(depth)}`
  const layOut = (token, position) => {
    if (OPENERS.includes(token) && CLOSERS.includes(tokens[position + 1])) return token
    if (CLOSERS.includes(token) && OPENERS.includes(tokens[position - 1])) return token
    if (OPENERS.includes(token)) {
      depth += 1
      return token + lineBreak()
    }
    if (CLOSERS.includes(token)) {
      depth -= 1
      return lineBreak() + token
    }
    if (token === ',') return token + lineBreak()
    if (token === ':') return ': '
    return token
  }
  return tokens.map(layOut).join('')
}

export const formatJSON = (text) => (isValid(text) ? reindent(text) : text)
