import { useEffect, useState } from 'react'

const IDLE = { report: null, error: '', text: '', isChecking: true }

export function useSpecLint(source, lint) {
  const [state, setState] = useState(IDLE)

  useEffect(() => {
    let isCurrent = true
    setState((current) => ({ ...current, isChecking: true }))
    lint(source).then(
      (report) => isCurrent && setState({ report, error: '', text: source.text, isChecking: false }),
      (error) => isCurrent && setState({ report: null, error: error.message, text: source.text, isChecking: false }),
    )
    return () => {
      isCurrent = false
    }
  }, [source, lint])

  return state
}
