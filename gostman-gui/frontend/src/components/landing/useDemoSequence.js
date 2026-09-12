import { useEffect, useRef } from "react"

/**
 * Drives a showcase's scripted demo: runs each step at its offset, then restarts
 * after `loopAfter`. `reset` runs before every pass so a restart replays cleanly.
 *
 * `steps` and the callbacks are read from refs, so a showcase can define them
 * inline without re-arming the timers on every render.
 *
 * Each cycle is scheduled against a fixed start time rather than from whenever
 * the previous timer happened to fire, so throttled or coalesced timers cannot
 * accumulate drift. The demo restarts when the tab regains focus, where the
 * browser clamps timers hard enough to strand a replay mid-cycle.
 */
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
