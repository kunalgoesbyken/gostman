import { useId, useState } from "react"
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

function StageTab({ stage, isActive, idOf, onSelect }) {
  return (
    <button
      type="button"
      role="tab"
      id={idOf("tab", stage.id)}
      aria-selected={isActive}
      aria-controls={idOf("panel", stage.id)}
      tabIndex={isActive ? 0 : -1}
      onClick={() => onSelect(stage.id)}
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
  const [activeId, setActiveId] = useState(STAGES[0].id)
  const baseId = useId()
  const idOf = (part, id) => `${baseId}${part}-${id}`

  return (
    <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-12">
      <div className="min-w-0 lg:col-span-5">
        <SplitHeading
          as="h3"
          text="The same checks from your editor to production"
          className="text-2xl md:text-3xl font-semibold tracking-tight [text-wrap:balance]"
        />
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label="Where the checks run"
          onKeyDown={(event) => moveFocus(event, STAGE_KEYS)}
          className="mt-10 space-y-8 border-s border-border/70"
        >
          {STAGES.map((stage) => (
            <StageTab key={stage.id} stage={stage} isActive={stage.id === activeId} idOf={idOf} onSelect={setActiveId} />
          ))}
        </div>
      </div>
      <div className="reveal-on-scroll grid min-w-0 lg:col-span-7">
        {STAGES.map((stage) => (
          <div
            key={stage.id}
            id={idOf("panel", stage.id)}
            role="tabpanel"
            aria-labelledby={idOf("tab", stage.id)}
            className={cn("min-w-0 [grid-area:1/1] [&>figure]:h-full", stage.id !== activeId && "invisible")}
          >
            <TerminalBlock {...stage.capture} />
          </div>
        ))}
      </div>
    </div>
  )
}
