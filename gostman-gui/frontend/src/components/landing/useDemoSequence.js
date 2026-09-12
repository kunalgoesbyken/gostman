import { useEffect, useRef } from "react"

/**
 * Drives a showcase's scripted demo: runs each step at its offset, then restarts
 * after `loopAfter`. `reset` runs before every pass so a restart replays cleanly.
 *
 * `steps` and the callbacks are read from refs, so a showcase can define them
 * inline without re-arming the timers on every render.
 */
export const useDemoSequence = ({ steps, loopAfter, onStep, reset }) => {
  const latest = useRef({ steps, loopAfter, onStep, reset })
  latest.current = { steps, loopAfter, onStep, reset }

  useEffect(() => {
    const timeouts = []

    const run = () => {
      timeouts.forEach(clearTimeout)
      timeouts.length = 0

      const { steps, loopAfter, onStep, reset } = latest.current
      reset?.()
      steps.forEach((step) => {
        timeouts.push(setTimeout(() => onStep(step), step.delay))
      })
      timeouts.push(setTimeout(run, loopAfter))
    }

    run()
    return () => timeouts.forEach(clearTimeout)
  }, [])
}
