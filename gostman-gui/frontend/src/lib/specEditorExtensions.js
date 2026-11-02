import { EditorState } from '@codemirror/state'
import { specCompletion } from './specComplete'

export function specExtensions(format) {
  const completion = [{ autocomplete: specCompletion(format) }]
  return EditorState.languageData.of(() => completion)
}
