import { printable } from './console'

const AsyncFunction = (async () => {}).constructor
const WRAPPER_LINES = 2
const FRAME_POSITION = /^(.*):(\d+):(\d+)(?:\(\d+\))?\)?$/
const SYNTAX_POSITION = /Line (\d+):(\d+)/
const SYNTAX_ERROR = 'SyntaxError'

export const compileScript = (parameters, source) => new AsyncFunction(...parameters, source)

function framesOf(failure) {
  return String(failure?.stack || '').split('\n').map((line) => FRAME_POSITION.exec(line.trim())).filter(Boolean)
}

async function scriptSite() {
  try {
    await compileScript([], 'throw new Error()')()
  } catch (probe) {
    return framesOf(probe)[0]?.[1]
  }
  return undefined
}

async function positionIn(failure) {
  const site = await scriptSite()
  const frame = framesOf(failure).find(([, where, line]) => where === site && Number(line) > WRAPPER_LINES)
  return frame ? { line: Number(frame[2]) - WRAPPER_LINES, column: Number(frame[3]) } : null
}

const describePosition = ({ line, column }) => `line ${line}, column ${column}`

function describeSyntaxError(message) {
  return message.replace(SYNTAX_POSITION, (_, line, column) => describePosition({ line: Number(line) - WRAPPER_LINES, column }))
}

export async function describeFailure(failure) {
  const text = printable(failure)
  if (failure?.name === SYNTAX_ERROR && SYNTAX_POSITION.test(failure.message)) return describeSyntaxError(failure.message)
  const position = await positionIn(failure)
  return position ? `${text} (${describePosition(position)})` : text
}
