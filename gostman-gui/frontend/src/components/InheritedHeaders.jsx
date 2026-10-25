import { useMemo } from "react"
import { SectionLabel } from "./ui/panel"
import { ROW_GRID } from "./KeyValueEditor"
import { FOLDER_SETTINGS_TEXT as TEXT } from "../lib/folderSettingsText"
import { HEADER_SENT, inheritedHeaderRows, lineageOf } from "../lib/inheritance"
import { cn } from "../lib/utils"
import { useAppStore } from "../store/appStore"

const COLUMNS = "grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,auto)]"
const CELL = "truncate font-mono text-xs"

function InheritedRow({ row, onOpen }) {
  const isSent = row.state === HEADER_SENT
  return (
    <div className={cn(ROW_GRID, COLUMNS, "h-7")}>
      <span />
      <span title={row.key} className={cn(CELL, "px-2", isSent ? "text-foreground" : "text-muted-foreground line-through")}>{row.key}</span>
      <span title={row.value} className={cn(CELL, "px-2", isSent ? "text-foreground" : "text-muted-foreground line-through")}>{row.value}</span>
      <span className="flex min-w-0 items-center justify-end gap-2 text-2xs text-muted-foreground">
        {!isSent && <span className="shrink-0">{TEXT.headerStates[row.state]}</span>}
        <button type="button" title={TEXT.openSource(row.source.name)} onClick={() => onOpen(row.source.id)} className="truncate underline-offset-2 hover:text-foreground hover:underline">
          {row.source.name}
        </button>
      </span>
    </div>
  )
}

export function InheritedHeaders({ folderId, ownRows }) {
  const folders = useAppStore((state) => state.folders)
  const collectionSettings = useAppStore((state) => state.collectionSettings)
  const workspaceStatus = useAppStore((state) => state.workspaceStatus)
  const openFolderSettings = useAppStore((state) => state.openFolderSettings)
  const rows = useMemo(
    () => inheritedHeaderRows(lineageOf({ folders, collectionSettings, workspaceStatus }, folderId), ownRows),
    [folders, collectionSettings, workspaceStatus, folderId, ownRows],
  )
  if (rows.length === 0) return null
  return (
    <section aria-label={TEXT.inheritedTitle} className="flex flex-col gap-1">
      <SectionLabel className="pl-8">{TEXT.inheritedTitle}</SectionLabel>
      {rows.map((row, index) => <InheritedRow key={index} row={row} onOpen={openFolderSettings} />)}
    </section>
  )
}
