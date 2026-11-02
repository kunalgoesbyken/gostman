import { docPath } from "../../docs/manifest"
import { VSCODE_MARKETPLACE_URL } from "../../lib/siteLinks"
import { EDITOR_ENTRIES } from "./content"
import { ArrowUpRight } from "./icons"

const hrefFor = (entry) => (entry.key === "vscode" ? VSCODE_MARKETPLACE_URL : docPath(entry.docs))

export function EditorStrip({ className, style }) {
  return (
    <ul className={`grid gap-3 text-left sm:grid-cols-2 ${className}`} style={style}>
      {EDITOR_ENTRIES.map((entry) => (
        <li key={entry.key} className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card/40 px-4 py-3">
          <span className="text-sm font-medium text-foreground">{entry.title}</span>
          <span className="text-sm leading-relaxed text-muted-foreground">{entry.text}</span>
          <a href={hrefFor(entry)} className="mt-1 inline-flex items-center gap-1 text-sm text-foreground underline underline-offset-4">
            {entry.link}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  )
}
