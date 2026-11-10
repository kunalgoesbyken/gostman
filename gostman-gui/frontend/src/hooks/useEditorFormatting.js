import { useRef, useState } from "react"

export function useEditorFormatting(text, language) {
  const editorRef = useRef(null)
  const [problem, setProblem] = useState(null)
  const shownProblem = problem && problem.text === text && problem.language === language ? problem.error : null

  const onFormat = (result) => setProblem(result.error ? { error: result.error, text, language } : null)
  const format = () => editorRef.current?.format()
  const reveal = (offset) => editorRef.current?.reveal(offset)
  return { editorRef, shownProblem, onFormat, format, reveal }
}
