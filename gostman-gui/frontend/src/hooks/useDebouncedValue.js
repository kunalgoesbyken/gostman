import { useEffect, useState } from 'react'

export function useDebouncedValue(value, delayMs, scope) {
  const [settled, setSettled] = useState({ scope, value })

  useEffect(() => {
    const settle = (current) => (current.scope === scope && current.value === value ? current : { scope, value })
    const timer = setTimeout(() => setSettled(settle), delayMs)
    return () => clearTimeout(timer)
  }, [scope, value, delayMs])

  return settled.scope === scope ? settled.value : value
}
