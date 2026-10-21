import { memo, useCallback, useMemo, useState } from "react"
import {
  ChevronDown, ChevronRight, Copy, FileJson, FileSearch, RefreshCw, Folder, FolderInput, FolderPlus, ListChecks, MoreHorizontal, Pencil, Plus, Search, Settings2, Share2, Trash2,
} from "lucide-react"
import { IconButton } from "./ui/button"
import { ContextMenu } from "./ui/ContextMenu"
import { EmptyState } from "./ui/emptyState"
import { VirtualList } from "./ui/VirtualList"
import { MethodTag } from "./MethodTag"
import { SearchField } from "./SearchField"
import { useAppStore } from "../store/appStore"
import { buildCollectionTree, findMatches, flattenCollection, listFolders, ROOT_ID, ROW_FOLDER } from "../lib/collectionTree"
import { FOLDER_SETTINGS_TEXT } from "../lib/folderSettingsText"
import { shortcutLabel } from "../lib/platform"
import { SPEC_TEXT } from "../lib/specText"
import { cn } from "../lib/utils"

const ROW_HEIGHT_PX = 28
const INDENT_STEP_PX = 12
const BASE_PADDING_PX = 12
const MAX_INDENT_LEVELS = 10
const MENU_ACTIONS = "actions"
const MENU_MOVE = "move"
const UNTITLED = "Untitled"

const indentOf = (depth) => BASE_PADDING_PX + Math.min(depth, MAX_INDENT_LEVELS) * INDENT_STEP_PX

function specMenuItems(folder, actions) {
  return [
    { id: "spec-sync", label: SPEC_TEXT.checkForUpdates, icon: RefreshCw, onSelect: () => actions.openapi.check(folder.id) },
    { id: "spec-browse", label: SPEC_TEXT.browseSpec, icon: FileSearch, onSelect: () => actions.openapi.browseFolder(folder.id) },
  ]
}

function folderMenuItems(folder, actions, isLinked) {
  return [
    { id: "new-request", label: "New request", icon: Plus, onSelect: () => actions.newRequest(folder.id) },
    { id: "new-subfolder", label: "New subfolder", icon: FolderPlus, onSelect: () => actions.createFolder(folder.id) },
    { id: "run", label: "Run folder", icon: ListChecks, onSelect: () => actions.openRunner(folder.id) },
    { id: "share", label: "Share folder", icon: Share2, onSelect: () => actions.shareFolder(folder.id) },
    ...(isLinked ? specMenuItems(folder, actions) : []),
    { id: "settings", label: FOLDER_SETTINGS_TEXT.menuSettings, icon: Settings2, onSelect: () => actions.openFolderSettings(folder.id) },
    { id: "rename", label: "Rename", icon: Pencil, onSelect: () => actions.renameFolder(folder) },
    { id: "delete", label: "Delete", icon: Trash2, destructive: true, onSelect: () => actions.deleteFolder(folder) },
  ]
}

function requestMenuItems(request, actions, showMoveTargets) {
  return [
    { id: "rename", label: "Rename", icon: Pencil, onSelect: () => actions.renameRequest(request) },
    { id: "duplicate", label: "Duplicate", icon: Copy, onSelect: () => actions.duplicateRequest(request) },
    { id: "move", label: "Move to folder", icon: FolderInput, keepOpen: true, onSelect: showMoveTargets },
    { id: "delete", label: "Delete", icon: Trash2, destructive: true, onSelect: () => actions.deleteRequest(request) },
  ]
}

function moveTargetItems(request, tree, actions) {
  const targets = listFolders(tree)
  const isInFolder = targets.some(({ folder }) => folder.id === request.folderId)
  const topLevel = {
    id: "top-level",
    label: "Top level",
    disabled: !isInFolder,
    onSelect: () => actions.moveRequest(request, ROOT_ID),
  }
  const folders = targets.map(({ folder, depth }) => ({
    id: folder.id,
    label: folder.name,
    icon: Folder,
    indent: depth,
    disabled: folder.id === request.folderId,
    onSelect: () => actions.moveRequest(request, folder.id),
  }))
  return [topLevel, ...folders]
}

function menuItemsFor(menu, tree, actions, showMoveTargets, specLinks) {
  if (menu.row.kind === ROW_FOLDER) return folderMenuItems(menu.row.folder, actions, Boolean(specLinks[menu.row.folder.id]))
  if (menu.view === MENU_MOVE) return moveTargetItems(menu.row.request, tree, actions)
  return requestMenuItems(menu.row.request, actions, showMoveTargets)
}

const TreeRow = memo(function TreeRow({ row, isActive, isMenuOpen, onActivate, onOpenMenu }) {
  const isFolder = row.kind === ROW_FOLDER
  const item = isFolder ? row.folder : row.request
  const name = item.name || UNTITLED
  const Chevron = row.isOpen ? ChevronDown : ChevronRight

  const openMenuAtPointer = (event) => {
    event.preventDefault()
    onOpenMenu(row, { x: event.clientX, y: event.clientY })
  }
  const openMenuBelowButton = (event) => {
    const { left, bottom } = event.currentTarget.getBoundingClientRect()
    onOpenMenu(row, { x: left, y: bottom })
  }

  return (
    <div
      role="treeitem"
      aria-expanded={isFolder ? row.isOpen : undefined}
      aria-selected={isActive}
      onContextMenu={openMenuAtPointer}
      style={{ height: ROW_HEIGHT_PX }}
      className={cn(
        "group flex items-center pr-1.5 text-xs",
        isActive || isMenuOpen ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <button
        type="button"
        onClick={() => onActivate(row)}
        title={isFolder ? name : `${name}\n${item.url}`}
        style={{ paddingLeft: indentOf(row.depth) }}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        {isFolder ? (
          <>
            <Chevron className="h-3.5 w-3.5 shrink-0" />
            <Folder className="h-3.5 w-3.5 shrink-0" />
          </>
        ) : (
          <MethodTag method={item.method} className="w-10" />
        )}
        <span className={cn("truncate", isFolder && "font-medium text-foreground")}>{name}</span>
      </button>
      <IconButton
        label={`Actions for ${name}`}
        icon={MoreHorizontal}
        size="icon-xs"
        aria-haspopup="menu"
        onClick={openMenuBelowButton}
        className={cn("hover:bg-muted", !isMenuOpen && "opacity-0 focus-visible:opacity-100 group-hover:opacity-100")}
      />
    </div>
  )
})

export const CollectionTree = memo(function CollectionTree({ folders, requests, activeRequestId, actions }) {
  const [query, setQuery] = useState("")
  const [menu, setMenu] = useState(null)
  const toggleFolder = useAppStore((s) => s.toggleFolder)
  const specLinks = useAppStore((s) => s.specLinks)

  const tree = useMemo(() => buildCollectionTree(folders, requests), [folders, requests])
  const rows = useMemo(
    () => flattenCollection(tree, findMatches(folders, requests, query)),
    [tree, folders, requests, query]
  )

  const activateRow = useCallback((row) => {
    if (row.kind === ROW_FOLDER) toggleFolder(row.folder.id)
    else actions.openRequest(row.request)
  }, [toggleFolder, actions])

  const openMenu = useCallback((row, position) => setMenu({ row, position, view: MENU_ACTIONS }), [])
  const closeMenu = useCallback(() => setMenu(null), [])

  const menuItems = useMemo(() => {
    if (!menu) return []
    const showMoveTargets = () => setMenu((current) => current && { ...current, view: MENU_MOVE })
    return menuItemsFor(menu, tree, actions, showMoveTargets, specLinks)
  }, [menu, tree, actions, specLinks])

  const renderRow = (row) => (
    <TreeRow
      key={row.key}
      row={row}
      isActive={row.kind !== ROW_FOLDER && row.request.id === activeRequestId}
      isMenuOpen={menu?.row.key === row.key}
      onActivate={activateRow}
      onOpenMenu={openMenu}
    />
  )

  const isSearching = query.trim() !== ""

  return (
    <>
      <SearchField value={query} onChange={setQuery} placeholder="Search name or URL" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <EmptyState
            icon={isSearching ? Search : FileJson}
            title={isSearching ? "No results" : "No requests yet"}
            description={isSearching ? "No request name or URL matches." : `Press ${shortcutLabel("N")} to create one.`}
          />
        ) : (
          <VirtualList role="tree" aria-label="Collections" items={rows} rowHeight={ROW_HEIGHT_PX} renderRow={renderRow} className="h-full py-1" />
        )}
      </div>

      {menu && (
        <ContextMenu
          position={menu.position}
          title={menu.view === MENU_MOVE ? `Move "${menu.row.request.name}" to` : ""}
          items={menuItems}
          onClose={closeMenu}
        />
      )}
    </>
  )
})
