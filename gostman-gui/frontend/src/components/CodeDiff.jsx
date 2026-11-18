import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { MergeView } from '@codemirror/merge'
import { useEditorConfig } from './CodeEditor'
import { usePreferences } from '../lib/preferences'
import { baseExtensions, phraseExtension } from '../lib/codeEditor'

export function CodeDiff({ original, modified, language }) {
  const hostRef = useRef(null)
  const { editorFontSize } = usePreferences()
  const config = useEditorConfig(language, false)

  useEffect(() => {
    const extensions = [baseExtensions, phraseExtension(), config, EditorState.readOnly.of(true)]
    const view = new MergeView({
      parent: hostRef.current,
      a: { doc: original, extensions },
      b: { doc: modified, extensions },
    })
    return () => view.destroy()
  }, [original, modified, config])

  return <div ref={hostRef} dir="ltr" className="h-full [&>.cm-mergeView]:h-full" style={{ fontSize: editorFontSize }} />
}
