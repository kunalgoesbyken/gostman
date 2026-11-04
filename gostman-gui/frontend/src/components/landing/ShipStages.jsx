import { useEffect, useId, useRef, useState } from "react"
import { cn } from "../../lib/utils"
import { ORIENTATION, moveFocus } from "../../lib/rovingFocus"
import { CLI_RUN, PULL_REQUEST_COMMENT, SCHEDULED_RUN } from "./captures"
import { SplitHeading } from "./SplitHeading"
import { TerminalBlock } from "./TerminalBlock"

const STAGE_KEYS = { selector: "[role=tab]", orientation: ORIENTATION.vertical, activate: true }

const STAGES = [
  {
    id: "code",
    title: "While you code",
    description: "Press Send and the checks run beside the response. Run a folder with gostman run, or let Claude Code, Codex or Cursor run it through MCP before you open a pull request.",
    capture: CLI_RUN,
  },
  {
    id: "review",
    title: "On every pull request",
    description: "The GitHub Action runs the collection with secrets from the job, fails the build on a broken check and keeps one comment on the pull request with what broke. Other pipelines get JUnit, JSON and HTML reports.",
    capture: PULL_REQUEST_COMMENT,
  },
  {
    id: "production",
    title: "In production",
    description: "gostman run --every repeats the run on an interval and posts to Slack, Teams or Discord when it starts failing and again when it passes.",
    capture: SCHEDULED_RUN,
  },
]

const clamp = (value) => Math.min(1, Math.max(0, value))
const stageAt = (progress) => Math.min(STAGES.length - 1, Math.floor(progress * STAGES.length))
const middleOf = (index) => (index + 0.5) / STAGES.length

function pinnedTravel(track, pin) {
  return {
    pinTop: parseFloat(getComputedStyle(pin).top) || 0,
    travel: track.offsetHeight - pin.offsetHeight,
  }
}

function useScrollProgress(trackRef, pinRef) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const { pinTop, travel } = pinnedTravel(trackRef.current, pinRef.current)
      if (travel > 0) setProgress(clamp((pinTop - trackRef.current.getBoundingClientRect().top) / travel))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    schedule()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [trackRef, pinRef])

  const goTo = (target) => {
    const { pinTop, travel } = pinnedTravel(trackRef.current, pinRef.current)
    if (travel <= 0) {
      setProgress(target)
      return
    }
    const top = window.scrollY + trackRef.current.getBoundingClientRect().top - pinTop + travel * target
    window.scrollTo({ top, behavior: "smooth" })
  }

  return [progress, goTo]
}

function StageTab({ stage, isActive, idOf, onSelect }) {
  return (
    <button
      type="button"
      role="tab"
      id={idOf("tab", stage.id)}
      aria-selected={isActive}
      aria-controls={idOf("panel", stage.id)}
      tabIndex={isActive ? 0 : -1}
      onClick={onSelect}
      className="group relative block w-full ps-8 text-start"
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute start-0 top-1.5 h-2.5 w-2.5 -translate-x-1/2 border",
          isActive ? "border-primary bg-primary" : "border-border bg-background group-hover:border-muted-foreground"
        )}
      />
      <span className={cn("block text-lg font-medium", isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
        {stage.title}
      </span>
      <span className={cn("mt-2 block text-sm leading-relaxed", isActive ? "text-muted-foreground" : "text-muted-foreground/70")}>
        {stage.description}
      </span>
    </button>
  )
}

export function ShipStages() {
  const trackRef = useRef(null)
  const pinRef = useRef(null)
  const [progress, goTo] = useScrollProgress(trackRef, pinRef)
  const activeIndex = stageAt(progress)
  const baseId = useId()
  const idOf = (part, id) => `${baseId}${part}-${id}`

  return (
    <div ref={trackRef} className="lg:h-[220vh]">
      <div ref={pinRef} className="grid items-start gap-8 lg:sticky lg:top-24 lg:grid-cols-12 lg:gap-12">
        <div className="min-w-0 lg:col-span-5">
          <SplitHeading
            as="h3"
            text="The same checks from your editor to production"
            className="text-2xl md:text-3xl font-semibold tracking-tight [text-wrap:balance]"
          />
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Requests usually live in one tool, tests in another, and CI runs a copy of both. The copy is the one that drifts. Here one collection runs at every stage.
          </p>
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label="Where the checks run"
            onKeyDown={(event) => moveFocus(event, STAGE_KEYS)}
            className="relative mt-8 space-y-8 border-s border-border/70"
          >
            <span
              aria-hidden="true"
              className="absolute -start-px top-0 w-px origin-top bg-primary"
              style={{ height: "100%", transform: `scaleY(${progress})` }}
            />
            {STAGES.map((stage, index) => (
              <StageTab key={stage.id} stage={stage} isActive={index === activeIndex} idOf={idOf} onSelect={() => goTo(middleOf(index))} />
            ))}
          </div>
        </div>
        <div className="reveal-on-scroll grid min-w-0 lg:col-span-7">
          {STAGES.map((stage, index) => (
            <div
              key={stage.id}
              id={idOf("panel", stage.id)}
              role="tabpanel"
              aria-labelledby={idOf("tab", stage.id)}
              className={cn("min-w-0 [grid-area:1/1] [&>figure]:h-full", index !== activeIndex && "invisible")}
            >
              <TerminalBlock {...stage.capture} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
