import { BookOpen, Gauge, PenLine, Send, Server, ShieldAlert, Upload } from "lucide-react"
import { LandingBand } from "../LandingBand"
import { LinkRow } from "../LinkRow"
import { SectionHeader } from "../SectionHeader"
import { StaticCode } from "../StaticCode"

const ICONS = { book: BookOpen, send: Send, pen: PenLine, upload: Upload, server: Server, gauge: Gauge, shield: ShieldAlert }

const toolCount = (groups) => groups.reduce((total, group) => total + group.tools.reduce((sum, tool) => sum + tool.names.length, 0), 0)

function ToolGroup({ group }) {
  const Icon = ICONS[group.icon]
  return (
    <div className="grid gap-4 border-t border-border/60 py-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8">
      <h3 className="flex items-center gap-3 text-sm font-medium">
        <Icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
        {group.title}
      </h3>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {group.tools.map((tool) => (
          <div key={tool.names[0]} className="min-w-0">
            <dt className="flex flex-wrap gap-x-3 gap-y-1">
              {tool.names.map((name) => (
                <code key={name} className="font-mono text-sm text-foreground">{name}</code>
              ))}
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{tool.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function AgentsTools({ tools }) {
  return (
    <LandingBand id="tools" labelledBy="tools-heading" isTinted isEager>
      <SectionHeader id="tools-heading" eyebrow={tools.eyebrow} title={tools.title} lead={`gostman mcp offers ${toolCount(tools.groups)} tools in ${tools.groups.length} groups. Each carries read-only and destructive hints for the client.`} />
      <div className="mt-12 border-b border-border/60">
        {tools.groups.map((group) => (
          <ToolGroup key={group.id} group={group} />
        ))}
      </div>
      <div className="mt-14 grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <h3 className="text-lg font-medium tracking-tight">{tools.exposed.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{tools.exposed.text}</p>
        </div>
        <StaticCode lines={[tools.exposed.code]} />
      </div>
      <LinkRow links={tools.links} className="mt-10 text-sm" />
    </LandingBand>
  )
}
