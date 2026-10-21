import { useEffect, useState } from 'react'

const SCANNING = { report: null, error: '', isScanning: true }

export function useSecretScan(scan, collection, skipExamples) {
  const [state, setState] = useState(SCANNING)

  useEffect(() => {
    let isCurrent = true
    setState(SCANNING)
    scan.run(collection, skipExamples)
      .then((report) => isCurrent && setState({ report, error: '', isScanning: false }))
      .catch((error) => isCurrent && setState({ report: null, error: error?.message || String(error), isScanning: false }))
    return () => {
      isCurrent = false
    }
  }, [scan, collection, skipExamples])

  return state
}
