import { useState } from "react"
import { docPath } from "../../docs/manifest"
import { VSCODE_MARKETPLACE_URL } from "../../lib/siteLinks"
import { cn } from "../../lib/utils"
import { BrandIcon } from "../ui/brandIcon"
import { AGENT_PROMPT, AGENT_PROMPT_BUTTON, AGENT_PROMPT_NOTE, AGENT_SETUP_TITLE, AGENT_SKILL_COMMAND, MCP_CLIENTS, MCP_TITLE, VSCODE_BUTTON } from "./content"
import { useClipboardCopy } from "../../hooks/useClipboardCopy"
import { Check, Copy } from "./icons"
import { SectionLabel } from "./SectionLabel"
import { SplitHeading } from "./SplitHeading"
import { TerminalBlock } from "./TerminalBlock"
import { TerminalTabs } from "./TerminalTabs"
import { InlineLink } from "./InlineLink"

const QUIET_BUTTON = "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"

const CLIENT_TABS = MCP_CLIENTS.map((client) => ({
  id: client.id,
  content: (
    <span className="inline-flex items-center gap-1.5">
      <BrandIcon brand={client.id} />
      {client.label}
    </span>
  ),
}))

const textLines = (text) => text.split("\n").map((line) => ({ text: line, tone: "command" }))

const snippetLines = (client) => (client.file ? textLines(client.snippet) : [{ copy: client.snippet }])

function CopyPromptButton() {
  const { copied, copy } = useClipboardCopy(AGENT_PROMPT)
  const Icon = copied ? Check : Copy
  return (
    <button type="button" onClick={copy} className={QUIET_BUTTON}>
      <Icon className={copied ? "h-3.5 w-3.5 text-success" : "h-3.5 w-3.5"} aria-hidden="true" />
      {copied ? "Copied" : AGENT_PROMPT_BUTTON}
    </button>
  )
}

function SetupColumn({ title, children }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-3 text-sm font-medium text-foreground">{title}</h3>
      {children}
    </div>
  )
}

function McpSetup() {
  const [chosenId, setChosenId] = useState(MCP_CLIENTS[0].id)
  const active = MCP_CLIENTS.find((client) => client.id === chosenId)

  return (
    <SetupColumn title={MCP_TITLE}>
      <TerminalBlock
        header={<TerminalTabs label="MCP client" value={active.id} onChange={setChosenId} items={CLIENT_TABS} />}
        lines={snippetLines(active)}
        label={`Add the Gostman MCP server to ${active.label}`}
        copyText={active.file ? active.snippet : undefined}
      />
    </SetupColumn>
  )
}

function SkillSetup() {
  return (
    <SetupColumn title={AGENT_SETUP_TITLE}>
      <TerminalBlock lines={[{ copy: AGENT_SKILL_COMMAND }]} label="Install the Gostman Agent Skill" />
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <CopyPromptButton />
        <p className="text-sm text-muted-foreground">{AGENT_PROMPT_NOTE}</p>
      </div>
    </SetupColumn>
  )
}

export function EditorSection() {
  return (
    <section id="agents" className="render-when-visible relative px-6 py-24" aria-labelledby="agents-heading">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <SectionLabel number="002" label="Editor and agents" />
            <SplitHeading
              id="agents-heading"
              text="Set up your editor and coding agent"
              className="text-3xl font-semibold tracking-tight md:text-5xl [text-wrap:balance]"
            />
            <p className="mt-5 leading-relaxed text-muted-foreground">
              Run collections from VS Code, or register the MCP server with your agent. Both use the gostman command line:{" "}
              <InlineLink href={`${docPath("getting-started")}#install-the-command-line`}>install it</InlineLink>, then read the{" "}
              <InlineLink href={docPath("agents")}>MCP guide</InlineLink>.
            </p>
          </div>
          <a href={VSCODE_MARKETPLACE_URL} className={cn(QUIET_BUTTON, "self-start lg:self-auto")}>
            <BrandIcon brand="vscode" className="h-4 w-4" />
            {VSCODE_BUTTON}
          </a>
        </div>
        <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
          <McpSetup />
          <SkillSetup />
        </div>
      </div>
    </section>
  )
}
