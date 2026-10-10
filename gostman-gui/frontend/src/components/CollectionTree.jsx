import { memo, useCallback, useMemo, useState } from "react"
import {
  ChevronDown, ChevronRight, Copy, FileJson, Folder, FolderInput, FolderPlus, MoreHorizontal, Pencil, Plus, Search, Trash2,
} from "lucide-react"
import { ContextMenu } from "./ui/ContextMenu"
import { EmptyState } from "./ui/emptyState"
import { VirtualList } from "./ui/VirtualList"
import { SearchField } from "./SearchField"
import { useAppStore } from "../store/appStore"
import { buildCollectionTree, findMatches, flattenCollection, listFolders, ROOT_ID, ROW_FOLDER } from "../lib/collectionTree"
import { METHOD_COLORS } from "../lib/constants"
import { cn } from "../lib/utils"

const ROW_HEIGHT_PX = 28
const INDENT_STEP_PX = 12
const BASE_PADDING_PX = 8
const MAX_INDENT_LEVELS = 10
const MENU_ACTIONS = "actions"
const MENU_MOVE = "move"

const indentOf = (depth) => BASE_PADDING_PX + Math.min(depth, MAX_INDENT_LEVELS) * INDENT_STEP_PX

function folderMenuItems(folder, actions) {
  return [
    { id: "new-request", label: "New request", icon: Plus, onSelect: () => actions.newRequest(folder.id) },
    { id: "new-subfolder", label: "New subfolder", icon: FolderPlus, onSelect: () => actions.createFolder(folder.id) },
    { id: "rename", label: "Rename", icon: Pencil, onSelect: () => actions.renameFolder(folder) },
    { id: "delete", label: "Delete", icon: Trash2, destructive: true, onSelect: () => actions.deleteFolder(folder) },
  ]
}

function requestMenuItems(request, actions, showMoveTargets) {
  return [
    { id: "rename", label: "Rename", icon: Pencil, onSelect: () => actions.renameRequest(request) },
    { id: "duplicate", label: "Duplicate", icon: Copy, onSelect: () => actions.duplicateRequest(request) },
    { id: "move", label: "Move to…", icon: FolderInput, keepOpen: true, onSelect: showMoveTargets },
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

function menuItemsFor(menu, tree, actions, showMoveTargets) {
  if (menu.row.kind === ROW_FOLDER) return folderMenuItems(menu.row.folder, actions)
  if (menu.view === MENU_MOVE) return moveTargetItems(menu.row.request, tree, actions)
  return requestMenuItems(menu.row.request, actions, showMoveTargets)
}

const TreeRow = memo(function TreeRow({ row, isActive, isMenuOpen, onActivate, onOpenMenu }) {
  const isFolder = row.kind === ROW_FOLDER
  const item = isFolder ? row.folder : row.request
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
        "group flex items-center pr-1 text-xs",
        isActive ? "bg-accent text-foreground" : "text-foreground/80 hover:bg-accent/50",
        isMenuOpen && "bg-accent/50"
      )}
    >
      <button
        type="button"
        onClick={() => onActivate(row)}
        title={isFolder ? item.name : `${item.name}\n${item.url}`}
        style={{ paddingLeft: indentOf(row.depth) }}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-left outline-none focus-visible:bg-accent/50"
      >
        {isFolder ? (
          <>
            <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        ) : (
          <span className={cn("w-11 shrink-0 truncate font-mono text-[10px] font-semibold", METHOD_COLORS[item.method] || "text-muted-foreground")}>
            {item.method}
          </span>
        )}
        <span className={cn("truncate", isFolder && "font-medium")}>{item.name || "Untitled"}</span>
      </button>
      <button
        type="button"
        onClick={openMenuBelowButton}
        aria-label={`Actions for ${item.name}`}
        aria-haspopup="menu"
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground outline-none",
          "hover:bg-muted-foreground/20 hover:text-foreground focus-visible:bg-muted-foreground/20",
          isMenuOpen ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
        )}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
    </div>
  )
})

export const CollectionTree = memo(function CollectionTree({ folders, requests, activeRequestId, actions }) {
  const [query, setQuery] = useState("")
  const [menu, setMenu] = useState(null)
  const toggleFolder = useAppStore((s) => s.toggleFolder)

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
    return menuItemsFor(menu, tree, actions, showMoveTargets)
  }, [menu, tree, actions])

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
  const isEmpty = rows.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SearchField value={query} onChange={setQuery} placeholder="Search name or URL" />

      {isEmpty ? (
        <EmptyState
          icon={isSearching ? Search : FileJson}
          title={isSearching ? "No results" : "No requests yet"}
          description={isSearching ? "No request name or URL matches" : "Press Ctrl+N to start"}
        />
      ) : (
        <VirtualList
          role="tree"
          items={rows}
          rowHeight={ROW_HEIGHT_PX}
          renderRow={renderRow}
          className="min-h-0 flex-1 scrollbar-compact"
        />
      )}

      {menu && (
        <ContextMenu
          position={menu.position}
          title={menu.view === MENU_MOVE ? `Move "${menu.row.request.name}" to` : ""}
          items={menuItems}
          onClose={closeMenu}
        />
      )}
    </div>
  )
})
