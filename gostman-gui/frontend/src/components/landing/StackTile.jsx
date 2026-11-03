import { cn } from "../../lib/utils"
import { BrandIcon } from "../ui/brandIcon"
import { Logo } from "../ui/logo"

const TILE = "flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border"

function ToolTile({ tool, active, tileProps }) {
  const descriptionId = `integration-${tool.brand}`
  return (
    <a
      href={tool.href}
      aria-describedby={descriptionId}
      className={cn(TILE, "border-border/50 bg-card text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:border-border focus-visible:text-foreground", active && "border-border text-foreground")}
      {...tileProps(tool)}
    >
      <BrandIcon brand={tool.brand} className="h-7 w-7" />
      <span className="sr-only">{tool.name}</span>
      <span id={descriptionId} className="sr-only">
        {tool.line}
      </span>
    </a>
  )
}

export function StackTile({ slot, activeBrand, tileProps }) {
  if (slot.isCenter) {
    return (
      <div aria-hidden="true" className={cn(TILE, "border-border bg-muted")}>
        <Logo className="h-10 w-10" />
      </div>
    )
  }
  if (!slot.tool) return <div aria-hidden="true" className={cn(TILE, "border-border/30 bg-card/40")} />
  return <ToolTile tool={slot.tool} active={activeBrand === slot.tool.brand} tileProps={tileProps} />
}
