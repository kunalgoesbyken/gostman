import { BookOpen, GitMerge, Globe, KeyRound, Lock, PenLine, Send, Server, Tag, Upload } from "lucide-react"
import { BrandStrip } from "../../ui/brandIcon"
import { ArrowLink } from "../ArrowLink"
import { LandingBand } from "../LandingBand"
import { PageActions } from "../PageActions"
import { PageShell } from "../PageShell"
import { ProductCard } from "../ProductCard"
import { SectionHeader } from "../SectionHeader"
import { StaticCode } from "../StaticCode"
import { AgentTranscript } from "./AgentTranscript"

const ICONS = { book: BookOpen, send: Send, pen: PenLine, upload: Upload, server: Server, tag: Tag, globe: Globe, key: KeyRound, merge: GitMerge, lock: Lock }

function AgentsHero({ page }) {
  return (
    <section className="px-6 pb-24 pt-36 text-center">
      <p className="landing-eyebrow">MCP server</p>
      <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight [text-wrap:balance] md:text-6xl">{page.heading}</h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground [text-wrap:pretty]">{page.intro}</p>
      <div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted-foreground">
        <span>Works with</span>
        <BrandStrip brands={page.brands} />
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3">
        <ArrowLink href="#connect">Connect your agent</ArrowLink>
        <ArrowLink href="#safety">How it stays safe</ArrowLink>
      </div>
      <div className="mx-auto mt-16 max-w-3xl">
        <AgentTranscript lines={page.transcript} />
      </div>
    </section>
  )
}

function AgentsConnect({ connect }) {
  return (
    <LandingBand id="connect" labelledBy="connect-heading" isEager>
      <SectionHeader id="connect-heading" title={connect.title} lead={connect.lead} isCentered />
      <ol className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
        {connect.steps.map((step, index) => (
          <li key={step.title} className="landing-frame flex min-w-0 flex-col bg-muted/20 p-6">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 font-mono text-xs text-primary" aria-hidden="true">{index + 1}</span>
            <h3 className="mt-5 font-medium tracking-tight">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            <StaticCode lines={[step.code]} className="mt-5" />
          </li>
        ))}
      </ol>
      <p className="mt-10 text-center">
        <ArrowLink href={connect.link.href}>{connect.link.label}</ArrowLink>
      </p>
    </LandingBand>
  )
}

function ToolChips({ tools }) {
  return (
    <p className="mt-auto flex flex-wrap gap-1.5 pt-5">
      {tools.map((tool) => (
        <code key={tool} className="rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">{tool}</code>
      ))}
    </p>
  )
}

function CardSection({ id, section, columns, isTinted }) {
  return (
    <LandingBand id={id} labelledBy={`${id}-heading`} isTinted={isTinted} isEager>
      <SectionHeader id={`${id}-heading`} title={section.title} lead={section.lead} isCentered />
      <ul className={`mt-14 grid gap-4 sm:grid-cols-2 ${columns}`}>
        {section.items.map((item) => (
          <ProductCard key={item.title} icon={ICONS[item.icon]} title={item.title} text={item.text}>
            {item.tools ? <ToolChips tools={item.tools} /> : null}
          </ProductCard>
        ))}
      </ul>
      <p className="mt-10 text-center">
        <ArrowLink href={section.link.href}>{section.link.label}</ArrowLink>
      </p>
    </LandingBand>
  )
}

function AgentsClosing({ closing }) {
  return (
    <LandingBand labelledBy="closing-heading" isTinted isEager className="text-center">
      <SectionHeader id="closing-heading" title={closing.title} isCentered />
      <StaticCode lines={closing.code} className="mx-auto mt-10 max-w-2xl text-left" />
      <PageActions className="mt-10 justify-center" />
      <p className="mt-8">
        <ArrowLink href={closing.link.href}>{closing.link.label}</ArrowLink>
      </p>
    </LandingBand>
  )
}

export function AgentsPage({ page }) {
  return (
    <PageShell>
      <main>
        <AgentsHero page={page} />
        <AgentsConnect connect={page.connect} />
        <CardSection id="abilities" section={page.abilities} columns="lg:grid-cols-3" isTinted />
        <CardSection id="safety" section={page.safety} columns="lg:grid-cols-4" />
        <AgentsClosing closing={page.closing} />
      </main>
    </PageShell>
  )
}
