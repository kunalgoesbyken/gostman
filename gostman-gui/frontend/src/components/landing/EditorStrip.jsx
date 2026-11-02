import { useState } from "react"
import { docPath } from "../../docs/manifest"
import { VSCODE_MARKETPLACE_URL } from "../../lib/siteLinks"
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs"
import { BrandIcon } from "../ui/brandIcon"
import { AGENT_PROMPT, AGENT_PROMPT_BUTTON, AGENT_PROMPT_NOTE, AGENT_SETUP_TITLE, AGENT_SKILL_COMMAND, MCP_CLIENTS, MCP_NEEDS_CLI, MCP_TITLE, VSCODE_BUTTON } from "./content"
import { useClipboardCopy } from "../../hooks/useClipboardCopy"
import { ArrowUpRight, Check, Copy } from "./icons"
import { TerminalBlock } from "./TerminalBlock"

const textLines = (text) => text.split("\n").map((line) => ({ text: line, tone: "command" }))

function CopyPromptButton() {
  const { copied, copy } = useClipboardCopy(AGENT_PROMPT)
  const Icon = copied ? Check : Copy
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
    >
      <Icon className={copied ? "h-3.5 w-3.5 text-success" : "h-3.5 w-3.5"} aria-hidden="true" />
      {copied ? "Copied" : AGENT_PROMPT_BUTTON}
    </button>
  )
}

const snippetLines = (client) => (client.file ? textLines(client.snippet) : [{ copy: client.snippet }])

export function EditorStrip({ className, style }) {
  const [chosenId, setChosenId] = useState(MCP_CLIENTS[0].id)
  const active = MCP_CLIENTS.find((client) => client.id === chosenId)

  const header = (
    <Tabs value={active.id} onValueChange={setChosenId} className="h-full min-w-0">
      <TabsList label="MCP client">
        {MCP_CLIENTS.map((client) => (
          <TabsTrigger key={client.id} value={client.id}>
            <span className="inline-flex items-center gap-1.5">
              <BrandIcon brand={client.id} />
              {client.label}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )

  return (
    <div className={`mx-auto flex w-full max-w-xl flex-col items-center gap-6 text-left ${className}`} style={style}>
      <a
        href={VSCODE_MARKETPLACE_URL}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
      >
        <BrandIcon brand="vscode" className="h-4 w-4" />
        {VSCODE_BUTTON}
      </a>
      <div className="w-full">
        <p className="mb-2 text-sm font-medium text-foreground">{MCP_TITLE}</p>
        <TerminalBlock
          header={header}
          lines={snippetLines(active)}
          label={`Add the Gostman MCP server to ${active.label}`}
          copyText={active.file ? active.snippet : undefined}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {MCP_NEEDS_CLI}{" "}
          <a href={`${docPath("getting-started")}#install-the-command-line`} className="inline-flex items-center gap-0.5 text-foreground underline underline-offset-4">
            Install the CLI
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </a>
          {" · "}
          <a href={docPath("agents")} className="text-foreground underline underline-offset-4">
            MCP docs
          </a>
        </p>
      </div>
      <div className="w-full">
        <p className="mb-2 text-sm font-medium text-foreground">{AGENT_SETUP_TITLE}</p>
        <TerminalBlock lines={[{ copy: AGENT_SKILL_COMMAND }]} label="Install the Gostman Agent Skill" />
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <CopyPromptButton />
          <p className="text-xs text-muted-foreground">{AGENT_PROMPT_NOTE}</p>
        </div>
      </div>
    </div>
  )
}
