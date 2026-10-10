import { useEffect, useRef } from "react"

export const useDemoSequence = ({ steps, loopAfter, onStep, reset }) => {
  const latest = useRef({ steps, loopAfter, onStep, reset })
  latest.current = { steps, loopAfter, onStep, reset }

  useEffect(() => {
    const timeouts = []
    let cycleStart = 0
    let stopped = false

    const clear = () => {
      timeouts.forEach(clearTimeout)
      timeouts.length = 0
    }

    const run = () => {
      if (stopped) return
      clear()

      const { steps, loopAfter, onStep, reset } = latest.current
      reset?.()

      steps.forEach((step) => {
        timeouts.push(setTimeout(() => onStep(step), step.delay))
      })

      cycleStart += loopAfter
      timeouts.push(setTimeout(run, Math.max(0, cycleStart - Date.now())))
    }

    const start = () => {
      if (stopped) return
      cycleStart = Date.now()
      run()
    }

    const onVisibility = () => (document.hidden ? clear() : start())
    document.addEventListener("visibilitychange", onVisibility)
    start()

    return () => {
      stopped = true
      clear()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])
}
