import { useState } from "react"
import { docPath } from "../../docs/manifest"
import { VSCODE_MARKETPLACE_URL } from "../../lib/siteLinks"
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs"
import { BrandIcon } from "../ui/brandIcon"
import { AGENT_PROMPT, AGENT_PROMPT_NOTE, AGENT_SETUP_TITLE, AGENT_SKILL_COMMAND, AGENT_SKILL_NOTE, MCP_CLIENTS, MCP_NEEDS_CLI, MCP_TITLE, VSCODE_BUTTON } from "./content"
import { ArrowUpRight } from "./icons"
import { TerminalBlock } from "./TerminalBlock"

const textLines = (text) => text.split("\n").map((line) => ({ text: line, tone: "command" }))

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
        <TerminalBlock title="Skill" lines={[{ copy: AGENT_SKILL_COMMAND }]} label="Install the Gostman Agent Skill" />
        <p className="mt-2 text-xs text-muted-foreground">{AGENT_SKILL_NOTE}</p>
        <p className="mb-2 mt-5 text-xs text-muted-foreground">{AGENT_PROMPT_NOTE}</p>
        <TerminalBlock title="Prompt" lines={textLines(AGENT_PROMPT)} label="Prompt that sets up Gostman in a coding agent" copyText={AGENT_PROMPT} />
      </div>
    </div>
  )
}
