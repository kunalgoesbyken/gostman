import { LandingBand } from "../LandingBand"
import { LinkRow } from "../LinkRow"
import { SectionHeader } from "../SectionHeader"

function Rule({ rule, number }) {
  return (
    <li className="border-t border-border/60 pt-4">
      <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-hidden="true">
        {String(number).padStart(2, "0")}
      </span>
      <h3 className="mt-2 text-base font-medium tracking-tight">{rule.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{rule.text}</p>
    </li>
  )
}

export function AgentsSafety({ safety }) {
  return (
    <LandingBand id="safety" labelledBy="safety-heading" isEager>
      <SectionHeader id="safety-heading" eyebrow={safety.eyebrow} title={safety.title} lead={safety.lead} />
      <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {safety.rules.map((rule, index) => (
          <Rule key={rule.title} rule={rule} number={index + 1} />
        ))}
      </ul>
      <LinkRow links={safety.links} className="mt-10 text-sm" />
    </LandingBand>
  )
}

export function AgentsLimits({ limits }) {
  return (
    <LandingBand id="limits" labelledBy="limits-heading" isTinted isEager>
      <SectionHeader id="limits-heading" eyebrow={limits.eyebrow} title={limits.title} />
      <ul className="mt-10 max-w-3xl border-b border-border/60">
        {limits.items.map((item) => (
          <li key={item} className="border-t border-border/60 py-4 text-sm leading-relaxed text-foreground/90">
            {item}
          </li>
        ))}
      </ul>
      <LinkRow links={limits.links} className="mt-10 text-sm" />
    </LandingBand>
  )
}
