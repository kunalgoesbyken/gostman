import { SplitHeading } from "./SplitHeading"
import { revealStep } from "./revealStep"

export function SectionHeader({ id, eyebrow, title, lead }) {
  return (
    <header className="max-w-2xl">
      <p className="landing-eyebrow">{eyebrow}</p>
      <div className="mt-3">
        <SplitHeading id={id} text={title} />
      </div>
      {lead ? (
        <p className="landing-lead reveal-on-scroll mt-5" style={revealStep(1)}>
          {lead}
        </p>
      ) : null}
    </header>
  )
}
