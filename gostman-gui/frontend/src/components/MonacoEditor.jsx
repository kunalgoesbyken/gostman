import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { useVariableMap } from '../hooks/useVariableMap'
import { describeReference, findReferences, MAX_SUGGESTIONS, openReference } from '../lib/variables'
import './variables.css'

const THEME_NAME = 'gostman-dark'

const THEME = {
    base: 'vs-dark',
    inherit: true,
    rules: [
        { token: 'string', foreground: '5eead4' },
        { token: 'number', foreground: 'fb923c' },
        { token: 'keyword', foreground: '22d3ee' },
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'type', foreground: 'a78bfa' },
        { token: 'variable', foreground: 'f0f9ff' },
    ],
    colors: {
        'editor.background': '#030711',
        'editor.foreground': '#f0f9ff',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#22d3ee',
        'editor.selectionBackground': '#22d3ee40',
        'editor.lineHighlightBackground': '#0f1629',
        'editorCursor.foreground': '#22d3ee',
        'editorWhitespace.foreground': '#334155',
        'editorIndentGuide.background': '#1e293b',
        'editorIndentGuide.activeBackground': '#334155',
        'scrollbarSlider.background': '#334155',
        'scrollbarSlider.hoverBackground': '#475569',
        'scrollbarSlider.activeBackground': '#64748b',
    },
}

const defineTheme = (monaco) => monaco.editor.defineTheme(THEME_NAME, THEME)

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
      const text = info.defined ? '`' + info.name + '` = `' + info.shown + '`' : '`' + info.name + '` is not defined in the active environment'
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
      const suggestions = Array.from(variables.keys()).slice(0, MAX_SUGGESTIONS * 4).map((name) => ({
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
        options: { inlineClassName: (variables.has(ref.name) ? 'gm-var-ok' : 'gm-var-missing') + ' gm-var-monaco' },
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
    useVariableSupport(instance, variables)
    return (
        <Editor
            height={height}
            language={language}
            path={path}
            value={value}
            onChange={(next) => onChange?.({ target: { value: next || "" } })}
            beforeMount={(monaco) => {
                defineTheme(monaco)
                registerVariableProviders(monaco)
            }}
            onMount={(editor, monaco) => {
                setInstance({ editor, monaco })
            }}
            theme={THEME_NAME}
            options={{
                minimap: { enabled: false },
                fontSize: 12,
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                lineNumbers: "on",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                formatOnPaste: true,
                formatOnType: true,
                tabSize: 2,
                wordWrap: "on",
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
