import { memo, useEffect, useState } from "react"
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

export const TourCard = memo(function TourCard() {
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
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector("[role=dialog]:not([aria-modal=false]), [role=menu]")) finish()
    }
    window.addEventListener("keydown", skipOnEscape)
    return () => window.removeEventListener("keydown", skipOnEscape)
  }, [isShown])

  if (!isShown) return null
  const id = TOUR_STEP_IDS[step]
  const body = id === "variables" ? TEXT.steps.variables.body({ example: VARIABLE_EXAMPLE }) : id === "explore" ? TEXT.steps.explore.body({ shortcut: paletteShortcut }) : TEXT.steps[id].body

  return (
    <section aria-label={TEXT.label} className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-xs max-sm:flex-row max-sm:flex-wrap max-sm:items-center max-sm:gap-y-0 max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0 max-sm:px-3 max-sm:py-1 max-sm:shrink-0 sm:w-80">
      <p className="text-2xs text-muted-foreground max-sm:shrink-0">{TEXT.progress({ current: step + 1, total: TOUR_FINISHED })}</p>
      <h2 className="text-sm font-semibold max-sm:min-w-0 max-sm:flex-1 max-sm:truncate">{TEXT.steps[id].title}</h2>
      <p className="text-muted-foreground max-sm:order-last max-sm:line-clamp-2 max-sm:basis-full">{body}</p>
      <div className="flex justify-end gap-2 max-sm:shrink-0">
        <Button size="sm" variant="ghost" onClick={finish}>{TEXT.skip}</Button>
        <Button size="sm" onClick={advance}>{step + 1 >= TOUR_FINISHED ? TEXT.done : TEXT.next}</Button>
      </div>
    </section>
  )
})
