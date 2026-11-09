import { LandingBand } from "../LandingBand"
import { LinkRow } from "../LinkRow"
import { SectionHeader } from "../SectionHeader"
import { StaticCode } from "../StaticCode"

function Step({ step, number }) {
  return (
    <li className="flex min-w-0 flex-col gap-3 border-t border-border/60 pt-4">
      <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-hidden="true">
        {String(number).padStart(2, "0")}
      </span>
      <h3 className="text-lg font-medium tracking-tight">{step.title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
      {step.code ? <StaticCode lines={[step.code]} className="mt-auto" /> : null}
    </li>
  )
}

export function AgentsConnect({ connect }) {
  return (
    <LandingBand id="connect" labelledBy="connect-heading" isEager>
      <SectionHeader id="connect-heading" eyebrow={connect.eyebrow} title={connect.title} />
      <ol className="mt-12 grid gap-x-8 gap-y-10 md:grid-cols-3">
        {connect.steps.map((step, index) => (
          <Step key={step.title} step={step} number={index + 1} />
        ))}
      </ol>
      <div className="mt-14 grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <h3 className="text-lg font-medium tracking-tight">{connect.http.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{connect.http.text}</p>
        </div>
        <StaticCode lines={[connect.http.code]} />
      </div>
      <LinkRow links={connect.links} className="mt-10 text-sm" />
    </LandingBand>
  )
}
