import { useEffect, useId, useRef, useState } from "react"
import { cn } from "../../lib/utils"
import { ORIENTATION, moveFocus } from "../../lib/rovingFocus"
import { CLI_RUN, PULL_REQUEST_COMMENT, SCHEDULED_RUN } from "./captures"
import { SplitHeading } from "./SplitHeading"
import { TerminalBlock } from "./TerminalBlock"

const STAGE_KEYS = { selector: "[role=tab]", orientation: ORIENTATION.both, activate: true }

const STAGES = [
  {
    id: "code",
    title: "While you code",
    description: "Checks run beside every response. Run a folder with gostman run, or let your coding agent run it through MCP.",
    capture: CLI_RUN,
  },
  {
    id: "review",
    title: "On every pull request",
    description: "The GitHub Action fails the build on a broken check and keeps one comment on the pull request with what broke.",
    capture: PULL_REQUEST_COMMENT,
  },
  {
    id: "production",
    title: "In production",
    description: "gostman run --every repeats the run and posts to Slack, Teams or Discord when it starts failing.",
    capture: SCHEDULED_RUN,
  },
]

const clamp = (value) => Math.min(1, Math.max(0, value))
const stageAt = (progress) => Math.min(STAGES.length - 1, Math.floor(progress * STAGES.length))
const middleOf = (index) => (index + 0.5) / STAGES.length
const fillOf = (progress, index) => clamp(progress * STAGES.length - index)
const ordinal = (index) => String(index + 1).padStart(2, "0")

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

function StageTab({ stage, index, fill, isActive, idOf, onSelect }) {
  return (
    <button
      type="button"
      role="tab"
      id={idOf("tab", stage.id)}
      aria-selected={isActive}
      aria-controls={idOf("panel", stage.id)}
      tabIndex={isActive ? 0 : -1}
      onClick={onSelect}
      style={{ "--fill": fill }}
      className="group relative flex-1 border-border/60 px-4 py-4 text-start transition-colors hover:bg-muted/20 active:bg-muted/30 [&:not(:last-child)]:border-e lg:flex-none lg:px-6 lg:py-6 lg:[&:not(:last-child)]:border-b lg:[&:not(:last-child)]:border-e-0"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px origin-left scale-x-[var(--fill)] bg-primary lg:inset-x-auto lg:inset-y-0 lg:start-0 lg:h-auto lg:w-px lg:origin-top lg:scale-x-100 lg:scale-y-[var(--fill)]"
      />
      <span className={cn("block font-mono text-xs", isActive ? "text-primary" : "text-muted-foreground/70")}>{ordinal(index)}</span>
      <span className={cn("mt-1.5 block text-sm font-medium sm:text-base", isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
        {stage.title}
      </span>
      <span className={cn("mt-2 hidden text-sm leading-relaxed lg:block", isActive ? "text-muted-foreground" : "text-muted-foreground/60")}>
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
    <div ref={trackRef} className="lg:h-[200vh]">
      <div ref={pinRef} className="lg:sticky lg:top-28">
        <div className="max-w-2xl">
          <SplitHeading
            as="h3"
            text="The same checks from your editor to production"
            className="text-2xl md:text-3xl font-semibold tracking-tight [text-wrap:balance]"
          />
          <p className="mt-4 leading-relaxed text-muted-foreground [text-wrap:pretty]">
            Requests live in one tool, tests in another, and CI runs a copy of both. The copy is the one that drifts.
          </p>
        </div>
        <div className="reveal-on-scroll mt-8 grid overflow-hidden rounded-xl border border-border/60 bg-muted/10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div
            role="tablist"
            aria-label="Where the checks run"
            onKeyDown={(event) => moveFocus(event, STAGE_KEYS)}
            className="flex border-b border-border/60 lg:flex-col lg:border-b-0 lg:border-e"
          >
            {STAGES.map((stage, index) => (
              <StageTab
                key={stage.id}
                stage={stage}
                index={index}
                fill={fillOf(progress, index)}
                isActive={index === activeIndex}
                idOf={idOf}
                onSelect={() => goTo(middleOf(index))}
              />
            ))}
          </div>
          <p className="px-4 pt-4 text-sm leading-relaxed text-muted-foreground lg:hidden">{STAGES[activeIndex].description}</p>
          <div className="grid min-w-0 p-3 sm:p-4">
            {STAGES.map((stage, index) => (
              <div
                key={stage.id}
                id={idOf("panel", stage.id)}
                role="tabpanel"
                aria-labelledby={idOf("tab", stage.id)}
                className={cn("min-w-0 transition-[opacity,visibility] duration-300 ease-out [grid-area:1/1] [&>figure]:h-full", index !== activeIndex && "invisible opacity-0")}
              >
                <TerminalBlock {...stage.capture} isPlaying={index === activeIndex} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
