import { useState } from "react"
import { docPath } from "../../docs/manifest"
import vscode from "@iconify-icons/simple-icons/visualstudiocode"
import { VSCODE_MARKETPLACE_URL } from "../../lib/siteLinks"
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs"
import { SvgIcon } from "../ui/svgIcon"
import { MCP_CLIENTS, MCP_NEEDS_CLI, MCP_TITLE, VSCODE_BUTTON } from "./content"
import { ArrowUpRight } from "./icons"
import { TerminalBlock } from "./TerminalBlock"

const snippetLines = (client) =>
  client.file
    ? client.snippet.split("\n").map((text) => ({ text, tone: "command" }))
    : [{ copy: client.snippet }]

export function EditorStrip({ className, style }) {
  const [chosenId, setChosenId] = useState(MCP_CLIENTS[0].id)
  const active = MCP_CLIENTS.find((client) => client.id === chosenId)

  const header = (
    <Tabs value={active.id} onValueChange={setChosenId} className="h-full min-w-0">
      <TabsList label="MCP client">
        {MCP_CLIENTS.map((client) => (
          <TabsTrigger key={client.id} value={client.id}>
            {client.label}
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
        <SvgIcon icon={vscode} className="h-4 w-4" />
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
    </div>
  )
}
