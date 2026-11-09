import { LandingBand } from "../LandingBand"
import { LinkRow } from "../LinkRow"
import { PointList } from "../PointList"
import { SectionHeader } from "../SectionHeader"
import { StaticCode } from "../StaticCode"

export function AgentsWorkspace({ workspace }) {
  return (
    <LandingBand id="workspace" labelledBy="workspace-heading" isTinted isEager className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
      <div>
        <SectionHeader id="workspace-heading" eyebrow={workspace.eyebrow} title={workspace.title} lead={workspace.lead} />
        <LinkRow links={workspace.links} className="mt-8 text-sm" />
      </div>
      <PointList points={workspace.points} className="space-y-4" />
    </LandingBand>
  )
}

function ExitCode({ exit }) {
  return (
    <div className="border-t border-border/60 pt-4">
      <dt className="font-mono text-2xl tabular-nums">{exit.code}</dt>
      <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{exit.text}</dd>
    </div>
  )
}

export function AgentsCli({ cli }) {
  return (
    <LandingBand id="command-line" labelledBy="command-line-heading" isEager>
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeader id="command-line-heading" eyebrow={cli.eyebrow} title={cli.title} lead={cli.lead} />
          <PointList points={cli.points} className="mt-8 space-y-3" />
        </div>
        <StaticCode title={cli.codeTitle} lines={cli.code} />
      </div>
      <dl className="mt-14 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {cli.exitCodes.map((exit) => (
          <ExitCode key={exit.code} exit={exit} />
        ))}
      </dl>
      <LinkRow links={cli.links} className="mt-10 text-sm" />
    </LandingBand>
  )
}
