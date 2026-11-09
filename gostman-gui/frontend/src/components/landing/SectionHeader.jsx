import { cn } from "../../lib/utils"
import { SplitHeading } from "./SplitHeading"
import { revealStep } from "./revealStep"

export function SectionHeader({ id, eyebrow, title, lead, isCentered }) {
  return (
    <header className={cn("max-w-2xl", isCentered && "mx-auto text-center")}>
      {eyebrow ? <p className="landing-eyebrow mb-3">{eyebrow}</p> : null}
      <SplitHeading id={id} text={title} />
      {lead ? (
        <p className="landing-lead reveal-on-scroll mt-5 text-lg" style={revealStep(1)}>
          {lead}
        </p>
      ) : null}
    </header>
  )
}
