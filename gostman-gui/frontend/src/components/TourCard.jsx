import { useEffect, useState } from "react"
import { Button } from "./ui/button"
import { TOUR_FINISHED, TOUR_STEP_IDS, endTourReplay, useTourStore } from "../lib/tour"
import { TOUR_TEXT as TEXT } from "../lib/tourText"
import { updatePreferences, usePreferences } from "../lib/preferences"
import { useShortcutLabel } from "../hooks/useShortcuts"
import { useAppStore } from "../store/appStore"

const VARIABLE_EXAMPLE = "{{base_url}}"

function useTourTrigger() {
  const hasHistory = useAppStore((s) => s.requestHistory.length > 0)
  const hasRequests = useAppStore((s) => s.requests.length > 0)
  const hydrated = useAppStore((s) => s.hydrated)
  const isWelcomeDismissed = useAppStore((s) => s.welcomeDismissed)
  return hydrated && !isWelcomeDismissed && (hasHistory || hasRequests)
}

export function TourCard() {
  const { tourStep } = usePreferences()
  const isReplaying = useTourStore((s) => s.isReplaying)
  const isTriggered = useTourTrigger()
  const paletteShortcut = useShortcutLabel("commandPalette")
  const [replayStep, setReplayStep] = useState(0)
  const step = isReplaying ? replayStep : tourStep
  const isShown = isReplaying || (isTriggered && tourStep < TOUR_FINISHED)

  const finish = () => {
    updatePreferences({ tourStep: TOUR_FINISHED })
    endTourReplay()
    setReplayStep(0)
  }

  const advance = () => {
    if (step + 1 >= TOUR_FINISHED) finish()
    else if (isReplaying) setReplayStep(step + 1)
    else updatePreferences({ tourStep: step + 1 })
  }

  useEffect(() => {
    if (!isShown) return undefined
    const skipOnEscape = (event) => {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector("[role=dialog], [role=menu]")) finish()
    }
    window.addEventListener("keydown", skipOnEscape)
    return () => window.removeEventListener("keydown", skipOnEscape)
  }, [isShown])

  if (!isShown) return null
  const id = TOUR_STEP_IDS[step]
  const body = id === "variables" ? TEXT.steps.variables.body({ example: VARIABLE_EXAMPLE }) : id === "explore" ? TEXT.steps.explore.body({ shortcut: paletteShortcut }) : TEXT.steps[id].body

  return (
    <section aria-label={TEXT.label} className="fixed inset-x-4 bottom-10 z-30 flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-xs sm:inset-x-auto sm:start-4 sm:w-80">
      <p className="text-2xs text-muted-foreground">{TEXT.progress({ current: step + 1, total: TOUR_FINISHED })}</p>
      <h2 className="text-sm font-semibold">{TEXT.steps[id].title}</h2>
      <p className="text-muted-foreground">{body}</p>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={finish}>{TEXT.skip}</Button>
        <Button size="sm" onClick={advance}>{step + 1 >= TOUR_FINISHED ? TEXT.done : TEXT.next}</Button>
      </div>
    </section>
  )
}
