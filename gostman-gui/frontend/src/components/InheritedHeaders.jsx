import { useMemo } from "react"
import { SectionLabel } from "./ui/panel"
import { PLAIN_COLUMNS, ROW_GRID } from "./KeyValueEditor"
import { FOLDER_SETTINGS_TEXT as TEXT } from "../lib/folderSettingsText"
import { HEADER_SENT, inheritedHeaderRows, lineageOf } from "../lib/inheritance"
import { cn } from "../lib/utils"
import { useAppStore } from "../store/appStore"

const CELL = "truncate font-mono text-xs"

function InheritedRow({ row, onOpen }) {
  const isSent = row.state === HEADER_SENT
  const tone = isSent ? "text-foreground" : "text-muted-foreground line-through"
  return (
    <div className={cn(ROW_GRID, PLAIN_COLUMNS, "h-7")}>
      <span />
      <span title={row.key} className={cn(CELL, "px-2", tone)}>{row.key}</span>
      <span className="col-span-2 flex min-w-0 items-center gap-2">
        <span title={row.value} className={cn(CELL, "min-w-0 flex-1 px-2", tone)}>{row.value}</span>
        <span className="flex min-w-0 shrink items-center gap-2 text-2xs text-muted-foreground">
          {!isSent && <span className="shrink-0">{TEXT.headerStates[row.state]}</span>}
          <button type="button" title={TEXT.openSource(row.source.name)} onClick={() => onOpen(row.source.id)} className="truncate rounded px-1 underline-offset-2 hover:text-foreground hover:underline">
            {row.source.name}
          </button>
        </span>
      </span>
    </div>
  )
}

function InheritedAuthRow({ source, onOpen }) {
  return (
    <div className={cn(ROW_GRID, PLAIN_COLUMNS, "h-7")}>
      <span />
      <span className={cn(CELL, "px-2 text-foreground")}>{TEXT.authorizationHeader}</span>
      <span className="col-span-2 flex min-w-0 items-center gap-2">
        <span className={cn(CELL, "min-w-0 flex-1 px-2 text-foreground")}>{TEXT.authorizationValue(source)}</span>
        <button type="button" title={TEXT.openAuthTabTitle} onClick={onOpen} className="shrink-0 rounded px-1 text-2xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          {TEXT.openAuthTab}
        </button>
      </span>
    </div>
  )
}

export function InheritedHeaders({ folderId, ownRows, authSource, onOpenAuth }) {
  const folders = useAppStore((state) => state.folders)
  const collectionSettings = useAppStore((state) => state.collectionSettings)
  const workspaceStatus = useAppStore((state) => state.workspaceStatus)
  const openFolderSettings = useAppStore((state) => state.openFolderSettings)
  const rows = useMemo(
    () => inheritedHeaderRows(lineageOf({ folders, collectionSettings, workspaceStatus }, folderId), ownRows),
    [folders, collectionSettings, workspaceStatus, folderId, ownRows],
  )
  if (rows.length === 0 && !authSource) return null
  return (
    <section aria-label={TEXT.inheritedTitle} className="flex flex-col gap-1">
      <SectionLabel className="pl-8">{TEXT.inheritedTitle}</SectionLabel>
      {authSource && <InheritedAuthRow source={authSource} onOpen={onOpenAuth} />}
      {rows.map((row, index) => <InheritedRow key={index} row={row} onOpen={openFolderSettings} />)}
    </section>
  )
}
