import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { useVariableMap } from '../hooks/useVariableMap'
import { tripletToHex } from '../lib/colour'
import { useResolvedTheme, usePreferences } from '../lib/preferences'
import { VARIABLE_TEXT, describeReference, findReferences, isDefined, openReference, suggestNames } from '../lib/variables'
import './variables.css'

const THEME_NAME = 'gostman'

const tokenValue = (name) => getComputedStyle(document.documentElement).getPropertyValue(`--${name}`)

const hex = (name, alpha) => tripletToHex(tokenValue(name), alpha)

const rule = (token, name, fontStyle) => ({ token, foreground: hex(name).slice(1), fontStyle })

const buildTheme = (isDark) => ({
    base: isDark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
        rule('string', 'syntax-string'),
        rule('number', 'syntax-number'),
        rule('keyword', 'syntax-key'),
        rule('comment', 'muted-foreground', 'italic'),
        rule('type', 'syntax-boolean'),
        rule('variable', 'foreground'),
    ],
    colors: {
        'editor.background': hex('background'),
        'editor.foreground': hex('foreground'),
        'editorLineNumber.foreground': hex('muted-foreground'),
        'editorLineNumber.activeForeground': hex('primary'),
        'editor.selectionBackground': hex('primary', 0.25),
        'editor.lineHighlightBackground': hex('card'),
        'editorCursor.foreground': hex('primary'),
        'editorWhitespace.foreground': hex('border'),
        'editorIndentGuide.background1': hex('border'),
        'editorIndentGuide.activeBackground1': hex('muted-foreground'),
        'editorWidget.background': hex('card'),
        'editorWidget.foreground': hex('card-foreground'),
        'editorWidget.border': hex('border'),
        'editorSuggestWidget.selectedBackground': hex('accent'),
        'scrollbarSlider.background': hex('muted-foreground', 0.3),
        'scrollbarSlider.hoverBackground': hex('muted-foreground', 0.5),
        'scrollbarSlider.activeBackground': hex('muted-foreground', 0.7),
    },
})

const defineTheme = (monaco, isDark) => monaco.editor.defineTheme(THEME_NAME, buildTheme(isDark))

function useEditorTheme(instance) {
  const resolvedTheme = useResolvedTheme()
  useEffect(() => {
    if (!instance) return
    defineTheme(instance.monaco, resolvedTheme === 'dark')
    instance.monaco.editor.setTheme(THEME_NAME)
  }, [instance, resolvedTheme])
  return resolvedTheme
}

const VARIABLE_LANGUAGES = ['json', 'xml', 'plaintext']
const variablesByModel = new Map()
let providersRegistered = false

const modelVariables = (model) => variablesByModel.get(model.uri.toString())

function registerVariableProviders(monaco) {
  if (providersRegistered) return
  providersRegistered = true
  monaco.languages.registerHoverProvider(VARIABLE_LANGUAGES, {
    provideHover(model, position) {
      const variables = modelVariables(model)
      if (!variables) return null
      const offset = model.getOffsetAt(position)
      const found = findReferences(model.getValue()).find((ref) => offset >= ref.start && offset <= ref.end)
      if (!found) return null
      const info = describeReference(found.name, variables)
      const range = monaco.Range.fromPositions(model.getPositionAt(found.start), model.getPositionAt(found.end))
      const text = info.defined ? '`' + info.name + '` = `' + info.shown + '`' + (info.source ? ' (' + info.source + ')' : '') : '`' + info.name + '` ' + VARIABLE_TEXT.undefinedName
      return { range, contents: [{ value: text }] }
    },
  })
  monaco.languages.registerCompletionItemProvider(VARIABLE_LANGUAGES, {
    triggerCharacters: ['{'],
    provideCompletionItems(model, position) {
      const variables = modelVariables(model)
      if (!variables) return { suggestions: [] }
      const before = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column })
      const open = openReference(before, before.length)
      if (!open) return { suggestions: [] }
      const after = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: model.getLineMaxColumn(position.lineNumber) })
      const closing = /^\s*\}\}/.exec(after)
      const range = {
        startLineNumber: position.lineNumber,
        startColumn: open.start + 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column + (closing ? closing[0].length : 0),
      }
      const suggestions = suggestNames(variables, open.query).map((name) => ({
        label: name,
        kind: monaco.languages.CompletionItemKind.Variable,
        detail: describeReference(name, variables).shown,
        insertText: '{{' + name + '}}',
        filterText: '{{' + name,
        range,
      }))
      return { suggestions }
    },
  })
}

function useVariableSupport(instance, enabled) {
  const variables = useVariableMap()
  const [model, setModel] = useState(null)

  useEffect(() => {
    if (!instance) return undefined
    const { editor } = instance
    setModel(editor.getModel())
    const subscription = editor.onDidChangeModel(() => setModel(editor.getModel()))
    return () => subscription.dispose()
  }, [instance])

  useEffect(() => {
    if (!enabled || !model || !instance || model.isDisposed()) return undefined
    const { monaco } = instance
    const key = model.uri.toString()
    let decorations = []
    variablesByModel.set(key, variables)
    const paint = () => {
      const next = findReferences(model.getValue()).map((ref) => ({
        range: monaco.Range.fromPositions(model.getPositionAt(ref.start), model.getPositionAt(ref.end)),
        options: { inlineClassName: (isDefined(ref.name, variables) ? 'gm-var-ok' : 'gm-var-missing') + ' gm-var-monaco' },
      }))
      decorations = model.deltaDecorations(decorations, next)
    }
    paint()
    const subscription = model.onDidChangeContent(paint)
    return () => {
      subscription.dispose()
      variablesByModel.delete(key)
      if (!model.isDisposed()) model.deltaDecorations(decorations, [])
    }
  }, [enabled, model, instance, variables])
}

export function MonacoEditor({ value, onChange, language = "json", path, height = "300px", variables = false }) {
    const [instance, setInstance] = useState(null)
    const { editorFontSize, wrapLines } = usePreferences()
    const resolvedTheme = useEditorTheme(instance)
    useVariableSupport(instance, variables)
    return (
        <Editor
            height={height}
            language={language}
            path={path}
            value={value}
            onChange={(next) => onChange?.({ target: { value: next || "" } })}
            beforeMount={(monaco) => {
                defineTheme(monaco, resolvedTheme === 'dark')
                registerVariableProviders(monaco)
            }}
            onMount={(editor, monaco) => {
                setInstance({ editor, monaco })
            }}
            theme={THEME_NAME}
            options={{
                minimap: { enabled: false },
                fontSize: editorFontSize,
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                lineNumbers: "on",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                formatOnPaste: true,
                formatOnType: true,
                tabSize: 2,
                wordWrap: wrapLines ? "on" : "off",
                suggest: {
                    showKeywords: true,
                },
                quickSuggestions: {
                    other: true,
                    strings: true,
                },
            }}
        />
    )
}
