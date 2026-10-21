import { useMemo, useState } from "react"
import { Terminal, Trash2 } from "lucide-react"
import { IconButton } from "./ui/button"
import { EmptyState } from "./ui/emptyState"
import { SectionLabel, Toolbar } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { ALL_LEVELS, LEVELS, filterGroups, formatTime } from "../lib/consoleLog"
import { useAppStore } from "../store/appStore"
import { cn } from "../lib/utils"

const LEVEL_TONES = { warn: "text-warning", error: "text-destructive", debug: "text-muted-foreground" }
const LEVEL_OPTIONS = [ALL_LEVELS, ...LEVELS].map((level) => ({ value: level, label: level === ALL_LEVELS ? "All" : level }))
const TEXT = {
  filter: "Filter by level",
  clear: "Clear console",
  emptyTitle: "The console is empty",
  emptyDescription: "console.log() calls from pre-request and post-response scripts appear here, grouped by request.",
  nothingMatches: "No lines at this level",
  nothingMatchesDescription: "Choose another level to see the rest of the output.",
}

function ConsoleLine({ line }) {
  return (
    <li className="flex gap-2 py-0.5 font-mono text-xs leading-relaxed">
      <time className="shrink-0 text-muted-foreground">{formatTime(line.at)}</time>
      <span className={cn("w-10 shrink-0 text-muted-foreground", LEVEL_TONES[line.level])}>{line.level}</span>
      <pre className={cn("min-w-0 flex-1 whitespace-pre-wrap", LEVEL_TONES[line.level] || "text-foreground")}>{line.text}</pre>
    </li>
  )
}

function ConsoleGroup({ group }) {
  return (
    <section aria-label={group.title} className="border-b border-border px-3 py-2">
      <SectionLabel className="block truncate">{group.title}</SectionLabel>
      <ul>
        {group.lines.map((line, index) => <ConsoleLine key={index} line={line} />)}
      </ul>
    </section>
  )
}

export function ConsolePanel() {
  const groups = useAppStore((state) => state.consoleGroups)
  const clearConsole = useAppStore((state) => state.clearConsole)
  const [level, setLevel] = useState(ALL_LEVELS)
  const shown = useMemo(() => filterGroups(groups, level), [groups, level])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar>
        <SegmentedControl label={TEXT.filter} options={LEVEL_OPTIONS} value={level} onChange={setLevel} />
        <div className="flex-1" />
        <IconButton label={TEXT.clear} icon={Trash2} onClick={clearConsole} disabled={groups.length === 0} />
      </Toolbar>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.length === 0 && <EmptyState icon={Terminal} title={TEXT.emptyTitle} description={TEXT.emptyDescription} />}
        {groups.length > 0 && shown.length === 0 && (
          <EmptyState icon={Terminal} title={TEXT.nothingMatches} description={TEXT.nothingMatchesDescription} />
        )}
        {shown.map((group) => <ConsoleGroup key={group.id} group={group} />)}
      </div>
    </div>
  )
}
