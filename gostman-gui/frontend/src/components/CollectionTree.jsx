import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ClipboardPaste, FileJson, Plus, Search, Upload } from "lucide-react"
import { Button } from "./ui/button"
import { ContextMenu } from "./ui/ContextMenu"
import { EmptyState } from "./ui/emptyState"
import { VirtualList } from "./ui/VirtualList"
import { EmptyRow, ROW_HEIGHT_PX, TreeRow } from "./TreeRow"
import { SearchField } from "./SearchField"
import { useAppStore } from "../store/appStore"
import { usePointerDrag } from "../hooks/usePointerDrag"
import { buildCollectionTree, findMatches, flattenCollection, ROOT_ID, ROW_EMPTY, ROW_FOLDER } from "../lib/collectionTree"
import { PLACE_AFTER, PLACE_BEFORE, PLACE_INSIDE } from "../lib/dropPlace"
import { matchesBinding } from "../lib/shortcuts"
import { MENU_ACTIONS, MENU_MOVE, menuItemsFor } from "../lib/treeMenus"
import { STEP_DOWN, STEP_UP, TARGET_ROOT, canDropFolder } from "../lib/treeMoves"
import { TREE_TEXT } from "../lib/treeText"
import { cn } from "../lib/utils"

const FOLDER_EDGE_RATIO = 0.25
const EXPAND_DELAY_MS = 600
const ARROW_STEPS = { ArrowUp: STEP_UP, ArrowDown: STEP_DOWN }
const COPY = { mod: true, key: "c" }
const PASTE = { mod: true, key: "v" }
const DUPLICATE = { mod: true, key: "d" }

const sourceOf = (row) => (row.kind === ROW_FOLDER ? { kind: ROW_FOLDER, id: row.folder.id } : { kind: row.kind, id: row.request.id })

const folderTarget = (id) => ({ kind: ROW_FOLDER, id, place: PLACE_INSIDE })

function folderDrop(source, row, ratio, folders) {
  const { id, parentId } = row.folder
  if (source.kind !== ROW_FOLDER) return folderTarget(id)
  if (source.id === id) return null
  const place = ratio < FOLDER_EDGE_RATIO ? PLACE_BEFORE : ratio > 1 - FOLDER_EDGE_RATIO ? PLACE_AFTER : PLACE_INSIDE
  const containerId = place === PLACE_INSIDE ? id : parentId || ROOT_ID
  if (!canDropFolder(folders, source.id, containerId)) return null
  return { kind: ROW_FOLDER, id, place }
}

function requestDrop(source, row, ratio, folders) {
  const { id, folderId } = row.request
  if (source.kind === ROW_FOLDER) {
    if (folderId && !canDropFolder(folders, source.id, folderId)) return null
    return folderId ? folderTarget(folderId) : { kind: TARGET_ROOT }
  }
  if (source.id === id) return null
  return { kind: row.kind, id, place: ratio < 0.5 ? PLACE_BEFORE : PLACE_AFTER }
}

function dropFor(source, row, ratio, folders) {
  if (row.kind === ROW_EMPTY) return source.kind === ROW_FOLDER && !canDropFolder(folders, source.id, row.parentId) ? null : folderTarget(row.parentId)
  if (row.kind === ROW_FOLDER) return folderDrop(source, row, ratio, folders)
  return requestDrop(source, row, ratio, folders)
}

function dropPlaceFor(drop, row) {
  if (!drop || drop.kind === TARGET_ROOT) return null
  if (row.kind === ROW_EMPTY) return drop.kind === ROW_FOLDER && drop.id === row.parentId ? drop.place : null
  const id = row.kind === ROW_FOLDER ? row.folder.id : row.request.id
  return drop.kind === row.kind && drop.id === id ? drop.place : null
}

function DragChip({ drag, name }) {
  return createPortal(
    <div
      aria-hidden
      style={{ left: drag.point.x + 12, top: drag.point.y + 12 }}
      className="pointer-events-none fixed z-50 max-w-48 truncate rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
    >
      {name}
    </div>,
    document.body
  )
}

function TreeEmptyState({ isSearching, hasClipboard, actions }) {
  if (isSearching) return <EmptyState icon={Search} title={TREE_TEXT.noResultsTitle} description={TREE_TEXT.noResultsDescription} />
  return (
    <EmptyState
      icon={FileJson}
      title={TREE_TEXT.emptyTitle}
      description={TREE_TEXT.emptyDescription}
      action={(
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={() => actions.newRequest()}><Plus />{TREE_TEXT.emptyAction}</Button>
          <Button size="sm" variant="outline" onClick={actions.openImport}><Upload />{TREE_TEXT.emptyImport}</Button>
          {hasClipboard && <Button size="sm" variant="outline" onClick={() => actions.tree.pasteItem(null)}><ClipboardPaste />{TREE_TEXT.paste}</Button>}
        </div>
      )}
    />
  )
}

function useRevealRow(rows, scrollRef, clearQuery) {
  const revealTarget = useAppStore((s) => s.revealTarget)
  const handled = useRef(null)

  useEffect(() => {
    if (!revealTarget || handled.current === revealTarget.nonce) return
    clearQuery()
    const index = rows.findIndex((row) => row.request?.id === revealTarget.requestId)
    if (index < 0 || !scrollRef.current) return
    handled.current = revealTarget.nonce
    const { clientHeight } = scrollRef.current
    scrollRef.current.scrollTop = Math.max(0, index * ROW_HEIGHT_PX - (clientHeight - ROW_HEIGHT_PX) / 2)
  }, [revealTarget, rows, scrollRef, clearQuery])
}

function useExpandOnHover(drag, toggleFolder, folders) {
  const hovered = drag?.drop?.kind === ROW_FOLDER && drag.drop.place === PLACE_INSIDE ? drag.drop.id : null
  const isClosed = hovered !== null && folders.some((folder) => folder.id === hovered && !folder.isOpen)

  useEffect(() => {
    if (!isClosed) return undefined
    const timer = setTimeout(() => toggleFolder(hovered), EXPAND_DELAY_MS)
    return () => clearTimeout(timer)
  }, [hovered, isClosed, toggleFolder])
}

export const CollectionTree = memo(function CollectionTree({ folders, requests, activeRequestId, actions }) {
  const [query, setQuery] = useState("")
  const [menu, setMenu] = useState(null)
  const scrollRef = useRef(null)
  const toggleFolder = useAppStore((s) => s.toggleFolder)
  const specLinks = useAppStore((s) => s.specLinks)
  const treeClipboard = useAppStore((s) => s.treeClipboard)

  const tree = useMemo(() => buildCollectionTree(folders, requests), [folders, requests])
  const rows = useMemo(
    () => flattenCollection(tree, findMatches(folders, requests, query)),
    [tree, folders, requests, query]
  )
  const rowsByKey = useMemo(() => new Map(rows.map((row) => [row.key, row])), [rows])
  const hasClipboard = treeClipboard !== null

  const clearQuery = useCallback(() => setQuery(""), [])
  useRevealRow(rows, scrollRef, clearQuery)

  const resolveDrop = useCallback((element, point, source) => {
    const rowElement = element.closest("[data-row-key]")
    if (!rowElement) return element.closest("[role=tree]") ? { kind: TARGET_ROOT } : null
    const row = rowsByKey.get(rowElement.dataset.rowKey)
    if (!row) return null
    const { top, height } = rowElement.getBoundingClientRect()
    return dropFor(source, row, (point.y - top) / height, folders)
  }, [rowsByKey, folders])

  const { drag, begin } = usePointerDrag({
    resolveDrop,
    onDrop: actions.tree.moveItem,
    scrollRef,
  })
  useExpandOnHover(drag, toggleFolder, folders)

  const isSearching = query.trim() !== ""

  const activateRow = useCallback((row) => {
    if (row.kind === ROW_FOLDER) toggleFolder(row.folder.id)
    else actions.previewRequest(row.request)
  }, [toggleFolder, actions])

  const pinRow = useCallback((row) => {
    if (row.kind !== ROW_FOLDER) actions.openRequest(row.request)
  }, [actions])

  const openMenu = useCallback((row, position) => setMenu({ row, position, view: MENU_ACTIONS }), [])
  const closeMenu = useCallback(() => setMenu(null), [])

  const startDrag = useCallback((event, row) => {
    if (!isSearching) begin(event, sourceOf(row))
  }, [begin, isSearching])

  const handleKeyDown = useCallback((event, row) => {
    if (event.target.closest("[data-row-action]")) return
    const source = sourceOf(row)
    const step = event.altKey ? ARROW_STEPS[event.key] : undefined
    if (step) {
      event.preventDefault()
      actions.tree.stepItem(source, step)
    } else if (matchesBinding(COPY, event)) {
      event.preventDefault()
      actions.tree.copyItem(source)
    } else if (matchesBinding(PASTE, event)) {
      event.preventDefault()
      actions.tree.pasteItem(source)
    } else if (matchesBinding(DUPLICATE, event)) {
      event.preventDefault()
      actions.tree.duplicateItem(source)
    }
  }, [actions])

  const menuItems = useMemo(() => {
    if (!menu) return []
    const showMoveTargets = () => setMenu((current) => current && { ...current, view: MENU_MOVE })
    const context = {
      actions, tree, state: { folders, requests }, showMoveTargets, hasClipboard,
      isLinked: menu.row.kind === ROW_FOLDER && Boolean(specLinks[menu.row.folder.id]),
    }
    return menuItemsFor(menu, context)
  }, [menu, tree, folders, requests, actions, specLinks, hasClipboard])

  const renderRow = (row) => {
    const dropPlace = dropPlaceFor(drag?.drop, row)
    if (row.kind === ROW_EMPTY) return <EmptyRow key={row.key} row={row} dropPlace={dropPlace} />
    const isFolder = row.kind === ROW_FOLDER
    const id = isFolder ? row.folder.id : row.request.id
    return (
      <TreeRow
        key={row.key}
        row={row}
        isActive={!isFolder && id === activeRequestId}
        isMenuOpen={menu?.row.key === row.key}
        isDragged={drag?.source.kind === row.kind && drag.source.id === id}
        dropPlace={dropPlace}
        onActivate={activateRow}
        onPin={pinRow}
        onOpenMenu={openMenu}
        onPointerDown={startDrag}
        onKeyDown={handleKeyDown}
      />
    )
  }

  const draggedRow = drag && rowsByKey.get(`${drag.source.kind}:${drag.source.id}`)
  const draggedName = draggedRow && (draggedRow.folder || draggedRow.request).name
  const isDropAtRoot = drag?.drop?.kind === TARGET_ROOT

  return (
    <>
      <SearchField value={query} onChange={setQuery} placeholder="Search name or URL" />

      <div className={cn("min-h-0 flex-1", isDropAtRoot && "ring-1 ring-inset ring-primary")}>
        {rows.length === 0 ? (
          <TreeEmptyState isSearching={isSearching} hasClipboard={hasClipboard} actions={actions} />
        ) : (
          <VirtualList role="tree" aria-label="Collections" items={rows} rowHeight={ROW_HEIGHT_PX} renderRow={renderRow} scrollRef={scrollRef} className="h-full py-1" />
        )}
      </div>

      {drag && draggedName && <DragChip drag={drag} name={draggedName} />}

      {menu && (
        <ContextMenu
          position={menu.position}
          title={menu.view === MENU_MOVE ? TREE_TEXT.moveTitle((menu.row.folder || menu.row.request).name) : ""}
          items={menuItems}
          onClose={closeMenu}
        />
      )}
    </>
  )
})
