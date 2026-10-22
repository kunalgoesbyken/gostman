import { EditorState } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, hoverTooltip, keymap } from '@codemirror/view'
import { HighlightStyle, indentUnit, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { indentWithTab } from '@codemirror/commands'
import { linter } from '@codemirror/lint'
import { json } from '@codemirror/lang-json'
import { xml } from '@codemirror/lang-xml'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { tags } from '@lezer/highlight'
import { basicSetup } from 'codemirror'
import { CLOSING_REFERENCE, VARIABLE_TEXT, describeReference, findReferences, isDefined, openReference, suggestNames } from './variables'

const EDITOR_TEXT = {
  syntaxError: 'Syntax error',
}

const FONT_FAMILY = "'JetBrains Mono', 'Courier New', monospace"
const INDENT = '  '
const PLACEHOLDER_VALUE = '0'

const token = (name, alpha) => (alpha === undefined ? `hsl(var(--${name}))` : `hsl(var(--${name}) / ${alpha})`)

const lintRange = (name) => ({ backgroundImage: 'none', textDecoration: `underline wavy ${token(name)}`, textUnderlineOffset: '3px' })

const theme = EditorView.theme({
  '&': { height: '100%', color: token('foreground'), backgroundColor: token('background') },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: FONT_FAMILY, lineHeight: '1.6' },
  '.cm-content': { caretColor: token('primary') },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: token('primary') },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: token('primary', 0.25) },
  '.cm-activeLine': { backgroundColor: token('card') },
  '.cm-gutters': { backgroundColor: token('background'), color: token('muted-foreground'), border: 'none' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: token('primary') },
  '.cm-foldPlaceholder': { backgroundColor: token('accent'), color: token('muted-foreground'), border: 'none' },
  '.cm-selectionMatch': { backgroundColor: token('primary', 0.12) },
  '.cm-searchMatch': { backgroundColor: token('warning', 0.25) },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: token('primary', 0.3) },
  '&.cm-focused .cm-matchingBracket': { backgroundColor: token('primary', 0.2), outline: 'none' },
  '&.cm-focused .cm-nonmatchingBracket': { backgroundColor: token('destructive', 0.2) },
  '.cm-tooltip': {
    backgroundColor: token('card'),
    color: token('card-foreground'),
    border: `1px solid ${token('border')}`,
    borderRadius: 'var(--radius)',
    fontFamily: FONT_FAMILY,
    fontSize: '12px',
    overflow: 'hidden',
  },
  '.cm-tooltip-hover': { padding: '4px 8px', maxWidth: '20rem', overflowWrap: 'anywhere' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': { fontFamily: FONT_FAMILY, maxHeight: '12rem' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': { padding: '4px 8px' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: token('accent'), color: token('accent-foreground') },
  '.cm-completionDetail': { color: token('muted-foreground'), fontStyle: 'normal', marginLeft: '12px' },
  '.cm-completionMatchedText': { textDecoration: 'none', color: token('primary') },
  '.cm-panels': { backgroundColor: token('card'), color: token('foreground') },
  '.cm-panels.cm-panels-top': { borderBottom: `1px solid ${token('border')}` },
  '.cm-panels.cm-panels-bottom': { borderTop: `1px solid ${token('border')}` },
  '.cm-panel.cm-search': { fontSize: '12px' },
  '.cm-textfield': {
    backgroundColor: token('background'),
    color: token('foreground'),
    border: `1px solid ${token('border')}`,
    borderRadius: 'var(--radius)',
    fontSize: '12px',
  },
  '.cm-button': {
    backgroundColor: token('accent'),
    backgroundImage: 'none',
    color: token('accent-foreground'),
    border: `1px solid ${token('border')}`,
    borderRadius: 'var(--radius)',
    fontSize: '12px',
  },
  '.cm-specialChar': { color: token('destructive') },
  '.cm-snippetField': { backgroundColor: token('accent') },
  '.cm-lintRange-error': lintRange('destructive'),
  '.cm-lintRange-warning': lintRange('warning'),
  '.cm-lintRange-info, .cm-lintRange-hint': lintRange('muted-foreground'),
  '.cm-lintPoint:after': { borderBottomColor: token('destructive') },
  '.cm-lintPoint-warning:after': { borderBottomColor: token('warning') },
  '.cm-lintPoint-info:after, .cm-lintPoint-hint:after': { borderBottomColor: token('muted-foreground') },
  '.cm-lintRange-active': { backgroundColor: token('warning', 0.15) },
  '.cm-diagnostic-error': { borderLeftColor: token('destructive') },
  '.cm-diagnostic-warning': { borderLeftColor: token('warning') },
  '.cm-diagnostic-info, .cm-diagnostic-hint': { borderLeftColor: token('muted-foreground') },
  '.cm-panel.cm-panel-lint ul [aria-selected]': { backgroundColor: token('accent'), color: token('accent-foreground') },
  '.cm-mergeView &': { height: 'auto' },
  '&.cm-merge-a .cm-changedLine, .cm-deletedChunk': { backgroundColor: token('destructive', 0.1) },
  '&.cm-merge-b .cm-changedLine, .cm-insertedLine': { backgroundColor: token('success', 0.1) },
  '&.cm-merge-a .cm-changedText, .cm-deletedChunk .cm-deletedText': { background: token('destructive', 0.3) },
  '&.cm-merge-b .cm-changedText': { background: token('success', 0.3) },
  '&.cm-merge-a .cm-changedLineGutter, .cm-deletedLineGutter': { background: token('destructive') },
  '&.cm-merge-b .cm-changedLineGutter': { background: token('success') },
})

const highlightStyle = HighlightStyle.define([
  { tag: [tags.propertyName, tags.keyword, tags.tagName], color: token('syntax-key') },
  { tag: [tags.string, tags.special(tags.string), tags.attributeValue], color: token('syntax-string') },
  { tag: tags.number, color: token('syntax-number') },
  { tag: [tags.bool, tags.typeName, tags.className, tags.attributeName], color: token('syntax-boolean') },
  { tag: tags.null, color: token('syntax-null') },
  { tag: [tags.bracket, tags.separator, tags.angleBracket], color: token('syntax-punctuation') },
  { tag: tags.comment, color: token('muted-foreground'), fontStyle: 'italic' },
  { tag: tags.invalid, color: token('destructive') },
])

export const baseExtensions = [
  basicSetup,
  keymap.of([indentWithTab]),
  EditorState.tabSize.of(INDENT.length),
  indentUnit.of(INDENT),
  theme,
  syntaxHighlighting(highlightStyle),
]

const maskReferences = (text, references) => references.reduceRight(
  (masked, ref) => masked.slice(0, ref.start) + PLACEHOLDER_VALUE.padEnd(ref.end - ref.start) + masked.slice(ref.end),
  text,
)

function isJsonWithReferences(text) {
  const references = findReferences(text)
  if (references.length === 0) return false
  try {
    JSON.parse(maskReferences(text, references))
    return true
  } catch {
    return false
  }
}

function syntaxErrors(view) {
  const diagnostics = []
  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (node.type.isError) diagnostics.push({ from: node.from, to: node.to, severity: 'error', message: EDITOR_TEXT.syntaxError })
    },
  })
  return diagnostics
}

function jsonErrors(view) {
  const text = view.state.doc.toString()
  if (!text.trim() || isJsonWithReferences(text)) return []
  return syntaxErrors(view)
}

const LANGUAGES = {
  json: () => [json(), linter(jsonErrors)],
  xml: () => xml(),
  html: () => html(),
  javascript: () => [javascript(), linter(syntaxErrors)],
}

export const languageExtension = (language) => LANGUAGES[language]?.() ?? []

export const wrapExtension = (wrapLines) => (wrapLines ? EditorView.lineWrapping : [])

const variableDecorations = (doc, variables) => Decoration.set(
  findReferences(doc.toString()).map((ref) =>
    Decoration.mark({ class: `${isDefined(ref.name, variables) ? 'gm-var-ok' : 'gm-var-missing'} gm-var-code` }).range(ref.start, ref.end),
  ),
)

const highlightVariables = (variables) => ViewPlugin.define(
  (view) => ({
    decorations: variableDecorations(view.state.doc, variables),
    update(update) {
      if (update.docChanged) this.decorations = variableDecorations(update.state.doc, variables)
    },
  }),
  { decorations: (plugin) => plugin.decorations },
)

const span = (text, className) => {
  const element = document.createElement('span')
  element.textContent = text
  if (className) element.className = className
  return element
}

function variableTooltip(info) {
  const dom = document.createElement('div')
  dom.append(span(info.name, 'text-muted-foreground'), span(' = ', 'text-muted-foreground'))
  dom.append(info.defined ? span(info.shown) : span(VARIABLE_TEXT.undefinedName, 'text-warning'))
  if (info.source) dom.append(span(` (${info.source})`, 'text-muted-foreground'))
  return { dom }
}

const describeVariables = (variables) => hoverTooltip((view, pos) => {
  const line = view.state.doc.lineAt(pos)
  const offset = pos - line.from
  const found = findReferences(line.text).find((ref) => offset >= ref.start && offset <= ref.end)
  if (!found) return null
  return {
    pos: line.from + found.start,
    end: line.from + found.end,
    create: () => variableTooltip(describeReference(found.name, variables)),
  }
})

const completeVariables = (variables) => (context) => {
  const line = context.state.doc.lineAt(context.pos)
  const caret = context.pos - line.from
  const open = openReference(line.text, caret)
  if (!open) return null
  const closing = CLOSING_REFERENCE.exec(line.text.slice(caret))
  return {
    from: line.from + open.start,
    to: context.pos + (closing ? closing[0].length : 0),
    filter: false,
    options: suggestNames(variables, open.query).map((name) => ({
      label: name,
      apply: `{{${name}}}`,
      detail: describeReference(name, variables).shown,
      type: 'variable',
    })),
  }
}

export function variableExtension(variables) {
  const completion = [{ autocomplete: completeVariables(variables) }]
  return [
    highlightVariables(variables),
    describeVariables(variables),
    EditorState.languageData.of(() => completion),
  ]
}
