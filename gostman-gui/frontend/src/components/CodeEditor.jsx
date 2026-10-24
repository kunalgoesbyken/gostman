import { useEffect, useMemo, useRef } from 'react'
import { Annotation, Compartment, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { MergeView } from '@codemirror/merge'
import { useVariableMap } from '../hooks/useVariableMap'
import { usePreferences } from '../lib/preferences'
import { baseExtensions, languageExtension, variableExtension, wrapExtension } from '../lib/codeEditor'
import './variables.css'

const externalChange = Annotation.define()

const isUserChange = (update) => update.docChanged && !update.transactions.some((transaction) => transaction.annotation(externalChange))

function useEditorConfig(language, variables, fileReads) {
  const { wrapLines } = usePreferences()
  const variableMap = useVariableMap()
  return useMemo(
    () => [languageExtension(language), wrapExtension(wrapLines), variables ? variableExtension(variableMap, { fileReads }) : []],
    [language, wrapLines, variables, fileReads, variableMap],
  )
}

export function CodeEditor({ value = '', onChange, language = 'json', path, height = '300px', variables = false, fileReads = true, surface }) {
  const hostRef = useRef(null)
  const viewRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const compartment = useMemo(() => new Compartment(), [])
  const { editorFontSize } = usePreferences()
  const config = useEditorConfig(language, variables, fileReads)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          baseExtensions,
          compartment.of(config),
          EditorView.updateListener.of((update) => {
            if (isUserChange(update)) onChangeRef.current?.({ target: { value: update.state.doc.toString() } })
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => {
      viewRef.current = null
      view.destroy()
    }
  }, [path, compartment])

  useEffect(() => {
    viewRef.current?.dispatch({ effects: compartment.reconfigure(config) })
  }, [compartment, config])

  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === value) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value }, annotations: externalChange.of(true) })
  }, [value])

  return <div ref={hostRef} data-surface={surface} className="overflow-hidden" style={{ height, fontSize: editorFontSize }} />
}

export function CodeDiff({ original, modified, language }) {
  const hostRef = useRef(null)
  const { editorFontSize } = usePreferences()
  const config = useEditorConfig(language, false)

  useEffect(() => {
    const extensions = [baseExtensions, config, EditorState.readOnly.of(true)]
    const view = new MergeView({
      parent: hostRef.current,
      a: { doc: original, extensions },
      b: { doc: modified, extensions },
    })
    return () => view.destroy()
  }, [original, modified, config])

  return <div ref={hostRef} className="h-full [&>.cm-mergeView]:h-full" style={{ fontSize: editorFontSize }} />
}
