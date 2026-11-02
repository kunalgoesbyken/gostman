import { CODE_EDITOR_TEXT } from './codeEditorText'
import { localizedText } from './localized'
import { locate, parseSpecText, pointerSegments } from './specLocate'

const LINE_BREAK = String.fromCharCode(10)

function lineBounds(text, offset) {
  const start = text.lastIndexOf(LINE_BREAK, offset - 1) + 1
  const end = text.indexOf(LINE_BREAK, offset)
  return { from: start, to: end === -1 ? text.length : end }
}

const syntaxDiagnostics = (parsed) => parsed.errors.map((error) => ({
  from: error.pos[0],
  to: Math.max(error.pos[1], error.pos[0] + 1),
  severity: 'error',
  message: CODE_EDITOR_TEXT.syntaxError,
}))

const findingDiagnostics = (text, parsed, findings) => findings.map((finding) => ({
  ...lineBounds(text, locate(parsed, pointerSegments(finding.path)).offset),
  severity: finding.severity,
  message: localizedText(finding.localized, finding.message),
  source: finding.rule,
}))

export function specDiagnostics(text, findings) {
  const parsed = parseSpecText(text)
  return [...syntaxDiagnostics(parsed), ...findingDiagnostics(text, parsed, findings)]
}

export function findingOffset(text, finding) {
  return locate(parseSpecText(text), pointerSegments(finding.path)).offset
}
