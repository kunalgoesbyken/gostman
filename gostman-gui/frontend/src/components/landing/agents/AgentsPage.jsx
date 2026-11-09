import { BrandStrip } from "../../ui/brandIcon"
import { LandingBand } from "../LandingBand"
import { LinkRow } from "../LinkRow"
import { PageActions } from "../PageActions"
import { PageShell } from "../PageShell"
import { SplitHeading } from "../SplitHeading"
import { StaticCode } from "../StaticCode"
import { revealStep } from "../revealStep"
import { AgentsConnect } from "./AgentsConnect"
import { AgentsLimits, AgentsSafety } from "./AgentsSafety"
import { AgentsTools } from "./AgentsTools"
import { AgentsCli, AgentsWorkspace } from "./AgentsWorkflow"

function AgentsHero({ page }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-20 pt-36 lg:grid-cols-2 lg:gap-16">
      <div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] [text-wrap:balance]">{page.heading}</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{page.intro}</p>
        <BrandStrip brands={page.brands} className="mt-5" />
        <a href="#safety" className="mt-8 inline-block text-primary underline-offset-4 hover:underline">
          How the server limits what an agent can do
        </a>
      </div>
      <StaticCode title="terminal" lines={page.command} />
    </section>
  )
}

function AgentsClosing({ closing }) {
  return (
    <LandingBand labelledBy="closing-heading" isEager className="text-center">
      <SplitHeading id="closing-heading" text={closing.title} />
      <p className="landing-lead reveal-on-scroll mx-auto mt-5 max-w-xl" style={revealStep(1)}>
        {closing.text}
      </p>
      <StaticCode lines={closing.code} className="mx-auto mt-8 max-w-2xl text-left" />
      <PageActions className="mt-8 justify-center" />
      <LinkRow links={closing.links} className="mt-8 justify-center text-sm" />
    </LandingBand>
  )
}

export function AgentsPage({ page }) {
  return (
    <PageShell>
      <main>
        <AgentsHero page={page} />
        <AgentsConnect connect={page.connect} />
        <AgentsTools tools={page.tools} />
        <AgentsSafety safety={page.safety} />
        <AgentsWorkspace workspace={page.workspace} />
        <AgentsCli cli={page.cli} />
        <AgentsLimits limits={page.limits} />
        <AgentsClosing closing={page.closing} />
      </main>
    </PageShell>
  )
}
