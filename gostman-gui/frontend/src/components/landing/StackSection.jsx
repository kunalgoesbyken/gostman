import { cn } from "../../lib/utils"
import { IntegrationHint } from "./IntegrationHint"
import { SplitHeading } from "./SplitHeading"
import { StackTile } from "./StackTile"
import { TILE_COLUMNS, isLowered } from "./stackLayout"
import { useIntegrationHint } from "./useIntegrationHint"

export function StackSection() {
  const { wrapperRef, hint, tileProps } = useIntegrationHint()
  const activeBrand = hint?.tool.brand
  return (
    <section className="render-when-visible relative overflow-hidden border-t border-border/50 px-6 py-24" aria-labelledby="stack-heading">
      <div className="mx-auto max-w-6xl text-center">
        <SplitHeading id="stack-heading" text="Works with the tools you already use" />
        <p className="mx-auto mt-5 max-w-xl leading-relaxed text-muted-foreground">
          Import from other clients, read secrets from your vault, run checks in any CI and hand requests to your coding agent.
        </p>
      </div>
      <div ref={wrapperRef} role="group" aria-label="Integrations" className="relative mt-14">
        <div className="stack-fade flex justify-center gap-4">
          {TILE_COLUMNS.map((column, index) => (
            <div key={index} className={cn("flex shrink-0 flex-col gap-4", isLowered(index) && "translate-y-12")}>
              {column.map((slot) => (
                <StackTile key={slot.row} slot={slot} activeBrand={activeBrand} tileProps={tileProps} />
              ))}
            </div>
          ))}
        </div>
        <IntegrationHint hint={hint} />
      </div>
    </section>
  )
}
