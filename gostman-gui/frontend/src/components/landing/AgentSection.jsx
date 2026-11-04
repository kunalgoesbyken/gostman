import { useState } from "react"
import { VSCODE_MARKETPLACE_URL } from "../../lib/siteLinks"
import { BrandIcon, BrandStrip } from "../ui/brandIcon"
import { AGENT_PROMPT, AGENT_PROMPT_BUTTON, MCP_CLIENTS, VSCODE_BUTTON } from "./content"
import { useClipboardCopy } from "../../hooks/useClipboardCopy"
import { AgentChatMock } from "./AgentChatMock"
import { Check, Copy } from "./icons"
import { SplitHeading } from "./SplitHeading"
import { TerminalBlock } from "./TerminalBlock"
import { TerminalTabs } from "./TerminalTabs"

const QUIET_BUTTON = "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"

const AGENT_BRANDS = ["claude", "openai", "cursor", "vscode"]

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

function McpSetup() {
  const [chosenId, setChosenId] = useState(MCP_CLIENTS[0].id)
  const active = MCP_CLIENTS.find((client) => client.id === chosenId)

  return (
    <TerminalBlock
      header={<TerminalTabs label="MCP client" value={active.id} onChange={setChosenId} items={CLIENT_TABS} />}
      lines={snippetLines(active)}
      label={`Add the Gostman MCP server to ${active.label}`}
      copyText={active.file ? active.snippet : undefined}
    />
  )
}

export function AgentSection() {
  return (
    <div id="agents" className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="min-w-0 lg:col-span-5">
        <SplitHeading text="Your coding agent tests your API" className="text-3xl font-semibold tracking-tight md:text-4xl [text-wrap:balance]" />
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Claude Code, Codex and Cursor run your collection over MCP. Secrets stay hidden, and only your hosts are reachable.
        </p>
        <BrandStrip brands={AGENT_BRANDS} className="mt-5" />
        <div className="mt-8">
          <McpSetup />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={VSCODE_MARKETPLACE_URL} className={QUIET_BUTTON}>
            <BrandIcon brand="vscode" className="h-4 w-4" />
            {VSCODE_BUTTON}
          </a>
          <CopyPromptButton />
        </div>
      </div>
      <div className="reveal-on-scroll min-w-0 lg:col-span-7">
        <AgentChatMock />
      </div>
    </div>
  )
}
