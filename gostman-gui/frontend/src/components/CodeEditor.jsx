import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { Annotation, Compartment, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { MergeView } from '@codemirror/merge'
import { useVariableMap } from '../hooks/useVariableMap'
import { usePreferences } from '../lib/preferences'
import { baseExtensions, canFormat, formatDocument, formatKeymap, languageExtension, revealOffset, variableExtension, wrapExtension } from '../lib/codeEditor'
import { LARGE_BODY_CHARS } from '../lib/largeText'
import './variables.css'

const externalChange = Annotation.define()
const NO_EXTENSION = []

const highlightedLanguage = (language, text) => (text.length > LARGE_BODY_CHARS ? null : language)

const labelExtension = (label) => (label ? EditorView.contentAttributes.of({ 'aria-label': label }) : NO_EXTENSION)

const isUserChange = (update) => update.docChanged && !update.transactions.some((transaction) => transaction.annotation(externalChange))

function useEditorConfig(language, variables, fileReads, formatting = NO_EXTENSION, label = '') {
  const { wrapLines } = usePreferences()
  const variableMap = useVariableMap()
  return useMemo(
    () => [languageExtension(language), wrapExtension(wrapLines), variables ? variableExtension(variableMap, { fileReads }) : [], formatting, labelExtension(label)],
    [language, wrapLines, variables, fileReads, variableMap, formatting, label],
  )
}

function useFormatting(language, onFormat) {
  const onFormatRef = useRef(onFormat)
  const isFormattable = Boolean(onFormat) && canFormat(language)

  useEffect(() => {
    onFormatRef.current = onFormat
  }, [onFormat])

  return useMemo(() => {
    const run = (view) => onFormatRef.current?.(formatDocument(view, language))
    const runFromKeys = (view) => {
      run(view)
      return true
    }
    return { run, extension: isFormattable ? formatKeymap(runFromKeys) : NO_EXTENSION }
  }, [language, isFormattable])
}

export const CodeEditor = forwardRef(function CodeEditor(
  { value = '', onChange, onFormat, language = 'json', path, height = '300px', variables = false, fileReads = true, surface, label },
  ref,
) {
  const hostRef = useRef(null)
  const viewRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const emittedRef = useRef(value)
  const compartment = useMemo(() => new Compartment(), [])
  const { editorFontSize } = usePreferences()
  const formatting = useFormatting(language, onFormat)
  const config = useEditorConfig(highlightedLanguage(language, value), variables, fileReads, formatting.extension, label)

  useImperativeHandle(ref, () => ({
    format: () => viewRef.current && formatting.run(viewRef.current),
    reveal: (offset) => viewRef.current && revealOffset(viewRef.current, offset),
  }), [formatting])

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
            if (!isUserChange(update)) return
            emittedRef.current = update.state.doc.toString()
            onChangeRef.current?.({ target: { value: emittedRef.current } })
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
    if (!view || value === emittedRef.current) return
    emittedRef.current = value
    if (view.state.doc.toString() === value) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value }, annotations: externalChange.of(true) })
  }, [value])

  return <div ref={hostRef} data-surface={surface} className="overflow-hidden" style={{ height, fontSize: editorFontSize }} />
})

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
