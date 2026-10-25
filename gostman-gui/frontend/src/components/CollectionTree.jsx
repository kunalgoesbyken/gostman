import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronsDownUp, ClipboardPaste, FileJson, FileWarning, FolderInput, Plus, Search, Trash2, Upload, X } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { ContextMenu } from "./ui/ContextMenu"
import { EmptyState } from "./ui/emptyState"
import { VirtualList, scrollIndexIntoView } from "./ui/VirtualList"
import { EmptyRow, ROW_HEIGHT_PX, TreeRow } from "./TreeRow"
import { LabelDialog } from "./LabelDialog"
import { SearchField } from "./SearchField"
import { useAppStore } from "../store/appStore"
import { isCollectionRoot } from "../lib/environmentScope"
import { inlineStart, isRtl } from "../hooks/direction"
import { usePointerDrag } from "../hooks/usePointerDrag"
import { useTypeahead } from "../hooks/useTypeahead"
import { buildCollectionTree, buildSearchIndex, findMatches, flattenCollection, ROOT_ID, ROW_EMPTY, ROW_FOLDER, siblingsIn } from "../lib/collectionTree"
import { checksContract, syncsSpec } from "../lib/contractCheck"
import { PLACE_AFTER, PLACE_BEFORE, PLACE_INSIDE } from "../lib/dropPlace"
import { hasModifier, isFocusLost } from "../lib/rovingFocus"
import { TREE_CHORDS, isRemoveKey, matchesBinding } from "../lib/shortcuts"
import { MENU_ACTIONS, MENU_MOVE, MENU_OWNER_SELECTION, menuItemsFor } from "../lib/treeMenus"
import { STEP_DOWN, STEP_UP, TARGET_ROOT, canDropFolder } from "../lib/treeMoves"
import { firstChildRow, firstRow, lastRow, nearestRow, pageFrom, parentRow, rowLabel, stepFrom } from "../lib/treeNavigation"
import { TREE_TEXT } from "../lib/treeText"
import { isSelectable, existingKeys, orderedEntries, outermostEntries, rangeBetween, toggled } from "../lib/treeSelection"
import { findByPrefix, isTypedCharacter } from "../lib/typeahead"
import { cn } from "../lib/utils"

const FOLDER_EDGE_RATIO = 0.25
const EXPAND_DELAY_MS = 600
const REDO_CHORDS = [TREE_CHORDS.redo, TREE_CHORDS.redoAlternative]
const NO_SELECTION = new Set()

const isMenuKey = (event) => event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")

const isSource = (source, kind, id) => source?.kind === kind && source.id === id

const sourceOf = (row) => (row.kind === ROW_FOLDER ? { kind: ROW_FOLDER, id: row.folder.id } : { kind: row.kind, id: row.request.id })

const folderTarget = (id) => ({ kind: ROW_FOLDER, id, place: PLACE_INSIDE })

const fitsIn = (source, containerId, folders) => source.kind !== ROW_FOLDER || canDropFolder(folders, source.id, containerId)

function firstChildDrop(source, folderId, tree, folders) {
  const [first] = siblingsIn(tree, folderId)
  if (!first) return folderTarget(folderId)
  if (!fitsIn(source, folderId, folders) || (first.kind === source.kind && first.item.id === source.id)) return null
  return { kind: first.kind, id: first.item.id, place: PLACE_BEFORE }
}

function folderDrop(source, row, ratio, tree, folders) {
  const { id, parentId } = row.folder
  if (source.kind === ROW_FOLDER && source.id === id) return null
  const place = ratio < FOLDER_EDGE_RATIO ? PLACE_BEFORE : ratio > 1 - FOLDER_EDGE_RATIO ? PLACE_AFTER : PLACE_INSIDE
  if (place === PLACE_AFTER && row.isOpen) return firstChildDrop(source, id, tree, folders)
  if (!fitsIn(source, place === PLACE_INSIDE ? id : parentId || ROOT_ID, folders)) return null
  return { kind: ROW_FOLDER, id, place }
}

function requestDrop(source, row, ratio, folders) {
  const { id, folderId } = row.request
  if (source.kind === row.kind && source.id === id) return null
  if (!fitsIn(source, folderId || ROOT_ID, folders)) return null
  return { kind: row.kind, id, place: ratio < 0.5 ? PLACE_BEFORE : PLACE_AFTER }
}

function dropFor(source, row, ratio, tree, folders) {
  if (row.kind === ROW_EMPTY) return fitsIn(source, row.parentId, folders) ? folderTarget(row.parentId) : null
  if (row.kind === ROW_FOLDER) return folderDrop(source, row, ratio, tree, folders)
  return requestDrop(source, row, ratio, folders)
}

function dropPlaceFor(drop, row) {
  if (!drop || drop.kind === TARGET_ROOT) return null
  if (row.kind === ROW_EMPTY) return drop.kind === ROW_FOLDER && drop.id === row.parentId ? drop.place : null
  const id = row.kind === ROW_FOLDER ? row.folder.id : row.request.id
  return drop.kind === row.kind && drop.id === id ? drop.place : null
}

const isToggleClick = (event, isPicking) => event.ctrlKey || event.metaKey || (isPicking && !event.shiftKey)

function SelectionBar({ count, onMove, onDelete, onClear }) {
  return (
    <div role="toolbar" aria-label={TREE_TEXT.selectionBar} className="flex h-8 shrink-0 items-center gap-0.5 border-b border-border bg-accent/50 ps-3 pe-1">
      <span role="status" className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{TREE_TEXT.selectedCount(count)}</span>
      <IconButton label={TREE_TEXT.moveSelection} icon={FolderInput} onClick={onMove} aria-haspopup="menu" />
      <IconButton label={TREE_TEXT.deleteSelection} icon={Trash2} onClick={onDelete} className="hover:text-destructive" />
      <IconButton label={TREE_TEXT.clearSelection} icon={X} onClick={onClear} />
    </div>
  )
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

function UnreadableState({ problems, actions }) {
  return (
    <EmptyState
      icon={FileWarning}
      title={TREE_TEXT.unreadableTitle(problems.length)}
      description={TREE_TEXT.unreadableDescription}
      action={<Button size="sm" variant="outline" onClick={() => actions.storage?.showProblems(problems)}>{TREE_TEXT.unreadableAction}</Button>}
    />
  )
}

function TreeEmptyState({ isSearching, hasClipboard, actions }) {
  const problems = useAppStore((s) => s.workspaceStatus.problems)
  if (isSearching) return <EmptyState icon={Search} title={TREE_TEXT.noResultsTitle} description={TREE_TEXT.noResultsDescription} />
  if (problems.length > 0) return <UnreadableState problems={problems} actions={actions} />
  return (
    <EmptyState
      icon={FileJson}
      title={TREE_TEXT.emptyTitle}
      description={TREE_TEXT.emptyDescription}
      action={(
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={() => actions.newRequest()}><Plus />{TREE_TEXT.newRequest}</Button>
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
  const [labelTarget, setLabelTarget] = useState(null)
  const [focusedKey, setFocusedKey] = useState(null)
  const [focusRequest, setFocusRequest] = useState(null)
  const focusedIndex = useRef(-1)
  const focusCount = useRef(0)
  const scrollRef = useRef(null)
  const typeahead = useTypeahead()
  const toggleFolder = useAppStore((s) => s.toggleFolder)
  const collapseFolders = useAppStore((s) => s.collapseFolders)
  const specLinks = useAppStore((s) => s.specLinks)
  const workspacePath = useAppStore((s) => s.workspaceStatus.path)
  const treeClipboard = useAppStore((s) => s.treeClipboard)
  const sharedOrder = useAppStore((s) => s.sharedOrder)

  const shownQuery = useDeferredValue(query)
  const isSearching = shownQuery.trim() !== ""
  const tree = useMemo(() => buildCollectionTree(folders, requests, sharedOrder), [folders, requests, sharedOrder])
  const searchIndex = useMemo(() => (isSearching ? buildSearchIndex(folders, requests) : null), [folders, requests, isSearching])
  const rows = useMemo(
    () => flattenCollection(tree, searchIndex && findMatches(searchIndex, shownQuery)),
    [tree, searchIndex, shownQuery]
  )
  const rowsByKey = useMemo(() => new Map(rows.map((row) => [row.key, row])), [rows])
  const focusedRowIndex = useMemo(() => rows.findIndex((row) => row.key === focusedKey), [rows, focusedKey])
  const hasClipboard = treeClipboard !== null

  const [selection, setSelection] = useState(NO_SELECTION)
  const [isPicking, setIsPicking] = useState(false)
  const anchorKey = useRef(null)
  const selected = useMemo(() => existingKeys(selection, folders, requests), [selection, folders, requests])
  const selectedEntries = useMemo(() => orderedEntries(selected, tree), [selected, tree])
  const hasSelection = selected.size > 0
  const clearSelection = useCallback(() => {
    setSelection(NO_SELECTION)
    setIsPicking(false)
  }, [])

  useEffect(() => {
    if (!hasSelection) setIsPicking(false)
  }, [hasSelection])

  const clearQuery = useCallback(() => setQuery(""), [])
  useRevealRow(rows, scrollRef, clearQuery)

  const resolveDrop = useCallback((element, point, source) => {
    const rowElement = element.closest("[data-row-key]")
    if (!rowElement) return element.closest("[role=tree]") ? { kind: TARGET_ROOT } : null
    const row = rowsByKey.get(rowElement.dataset.rowKey)
    if (!row || (source.group && selected.has(row.key))) return null
    const { top, height } = rowElement.getBoundingClientRect()
    return dropFor(source, row, (point.y - top) / height, tree, folders)
  }, [rowsByKey, tree, folders, selected])

  const dropItems = useCallback((source, target) => (source.group ? actions.tree.moveItems(source.group, target) : actions.tree.moveItem(source, target)), [actions])

  const { drag, begin } = usePointerDrag({
    resolveDrop,
    onDrop: dropItems,
    scrollRef,
  })
  useExpandOnHover(drag, toggleFolder, folders)

  const activateRow = useCallback((row) => {
    if (row.kind === ROW_FOLDER) toggleFolder(row.folder.id)
    else actions.previewRequest(row.request)
  }, [toggleFolder, actions])

  const chooseRow = useCallback((row, event) => {
    if (event && isToggleClick(event, isPicking)) {
      anchorKey.current = row.key
      setSelection(toggled(selected, row.key))
      return
    }
    if (event?.shiftKey) {
      const range = rangeBetween(rows, anchorKey.current ?? focusedKey ?? row.key, row.key)
      setSelection(new Set(event.ctrlKey || event.metaKey ? [...selected, ...range] : range))
      return
    }
    anchorKey.current = row.key
    clearSelection()
    activateRow(row)
  }, [isPicking, selected, rows, focusedKey, clearSelection, activateRow])

  const selectRow = useCallback((source) => {
    const key = `${source.kind}:${source.id}`
    anchorKey.current = key
    setIsPicking(true)
    setSelection(new Set([...selected, key]))
  }, [selected])

  const pinRow = useCallback((row) => {
    if (row.kind !== ROW_FOLDER) actions.openRequest(row.request)
  }, [actions])

  const openMenu = useCallback((row, position) => {
    const owner = selected.size > 1 && selected.has(row.key) ? MENU_OWNER_SELECTION : undefined
    setMenu({ row, owner, position, view: MENU_ACTIONS })
  }, [selected])
  const openSelectionMenu = useCallback((event, view) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setMenu({ row: null, owner: MENU_OWNER_SELECTION, position: { x: inlineStart(rect), y: rect.bottom }, view })
  }, [])
  const closeMenu = useCallback(() => setMenu(null), [])
  const closeLabels = useCallback(() => setLabelTarget(null), [])
  const openMenuBelow = useCallback((element, row) => {
    const rect = element.getBoundingClientRect()
    openMenu(row, { x: inlineStart(rect), y: rect.bottom })
  }, [openMenu])

  const startDrag = useCallback((event, row) => {
    if (isSearching) return
    const isGroup = selected.has(row.key) && selected.size > 1
    begin(event, isGroup ? { ...sourceOf(row), group: outermostEntries(selectedEntries, folders, requests) } : sourceOf(row))
  }, [begin, isSearching, selected, selectedEntries, folders, requests])

  const tabStopKey = useMemo(() => {
    if (rowsByKey.has(focusedKey)) return focusedKey
    const active = rows.find((row) => row.request?.id === activeRequestId)
    return active ? active.key : rows[firstRow(rows)]?.key
  }, [rows, rowsByKey, focusedKey, activeRequestId])

  const focusRowAt = useCallback((index) => {
    const row = rows[index]
    if (!row) return
    focusedIndex.current = index
    focusCount.current += 1
    setFocusedKey(row.key)
    setFocusRequest({ key: row.key, count: focusCount.current })
    scrollIndexIntoView(scrollRef.current, index, ROW_HEIGHT_PX)
  }, [rows])

  const trackFocus = useCallback((row) => {
    focusedIndex.current = rows.findIndex((candidate) => candidate.key === row.key)
    setFocusedKey(row.key)
    setFocusRequest((current) => (current?.key === row.key ? null : current))
  }, [rows])

  useEffect(() => {
    if (focusedKey === null || rowsByKey.has(focusedKey)) return
    if (isFocusLost()) focusRowAt(nearestRow(rows, focusedIndex.current))
    else setFocusedKey(null)
  }, [rows, rowsByKey, focusedKey, focusRowAt])

  const enterResultsOnArrow = useCallback((event) => {
    if (event.key !== "ArrowDown") return
    event.preventDefault()
    focusRowAt(rows.findIndex((row) => row.key === tabStopKey))
  }, [rows, tabStopKey, focusRowAt])

  const editItem = useCallback((event, source) => {
    if (matchesBinding(TREE_CHORDS.moveUp, event)) return () => actions.tree.stepItem(source, STEP_UP)
    if (matchesBinding(TREE_CHORDS.moveDown, event)) return () => actions.tree.stepItem(source, STEP_DOWN)
    if (matchesBinding(TREE_CHORDS.copy, event)) return () => actions.tree.copyItem(source)
    if (matchesBinding(TREE_CHORDS.cut, event)) return () => actions.tree.cutItem(source)
    if (matchesBinding(TREE_CHORDS.paste, event)) return () => actions.tree.pasteItem(source)
    if (matchesBinding(TREE_CHORDS.duplicate, event)) return () => actions.tree.duplicateItem(source)
    if (matchesBinding(TREE_CHORDS.undo, event)) return actions.tree.undo
    if (REDO_CHORDS.some((chord) => matchesBinding(chord, event))) return actions.tree.redo
    return null
  }, [actions])

  const selectWithKeys = useCallback((event, row, index) => {
    const extendTo = (step) => () => {
      const next = stepFrom(rows, index, step)
      if (anchorKey.current === null) anchorKey.current = row.key
      focusRowAt(next)
      setSelection(new Set(rangeBetween(rows, anchorKey.current, rows[next].key)))
    }
    if (matchesBinding(TREE_CHORDS.extendDown, event)) return extendTo(1)
    if (matchesBinding(TREE_CHORDS.extendUp, event)) return extendTo(-1)
    if (matchesBinding(TREE_CHORDS.toggleSelect, event)) return () => chooseRow(row, { ctrlKey: true })
    if (matchesBinding(TREE_CHORDS.selectAll, event)) return () => setSelection(new Set(rows.filter(isSelectable).map((candidate) => candidate.key)))
    if (hasSelection && event.key === "Escape") return clearSelection
    return null
  }, [rows, hasSelection, chooseRow, focusRowAt, clearSelection])

  const navigate = useCallback((event, row, index) => {
    const isFolder = row.kind === ROW_FOLDER
    if (isRemoveKey(event) && selected.size > 1 && selected.has(row.key)) return () => actions.deleteItems(selectedEntries, clearSelection)
    if (isRemoveKey(event)) return () => (isFolder ? actions.deleteFolder(row.folder) : actions.deleteRequest(row.request))
    if (isTypedCharacter(event, typeahead.isTyping())) return () => focusRowAt(findByPrefix(rows.map(rowLabel), index, typeahead.type(event.key)))
    if (hasModifier(event)) return null
    const canToggle = isFolder && !isSearching
    const pageSize = Math.max(1, Math.floor(scrollRef.current.clientHeight / ROW_HEIGHT_PX) - 1)
    const keys = {
      ArrowDown: () => focusRowAt(stepFrom(rows, index, 1)),
      ArrowUp: () => focusRowAt(stepFrom(rows, index, -1)),
      Home: () => focusRowAt(firstRow(rows)),
      End: () => focusRowAt(lastRow(rows)),
      PageDown: () => focusRowAt(pageFrom(rows, index, 1, pageSize)),
      PageUp: () => focusRowAt(pageFrom(rows, index, -1, pageSize)),
      [isRtl() ? "ArrowLeft" : "ArrowRight"]: () => (canToggle && !row.isOpen ? toggleFolder(row.folder.id) : focusRowAt(firstChildRow(rows, index))),
      [isRtl() ? "ArrowRight" : "ArrowLeft"]: () => (canToggle && row.isOpen ? toggleFolder(row.folder.id) : focusRowAt(parentRow(rows, index))),
      Enter: () => (isFolder ? toggleFolder(row.folder.id) : pinRow(row)),
      " ": () => activateRow(row),
      F2: () => (isFolder ? actions.renameFolder(row.folder) : actions.renameRequest(row.request)),
    }
    return keys[event.key] ?? null
  }, [rows, isSearching, toggleFolder, focusRowAt, pinRow, activateRow, actions, typeahead, selected, selectedEntries, clearSelection])

  const handleKeyDown = useCallback((event, row) => {
    if (event.target.closest("[data-row-action]")) return
    const index = rows.findIndex((candidate) => candidate.key === row.key)
    const element = event.currentTarget
    const run = isMenuKey(event)
      ? () => openMenuBelow(element, row)
      : selectWithKeys(event, row, index) || editItem(event, sourceOf(row)) || navigate(event, row, index)
    if (!run) return
    event.preventDefault()
    run()
  }, [rows, openMenuBelow, selectWithKeys, editItem, navigate])

  const menuItems = useMemo(() => {
    if (!menu) return []
    const showMoveTargets = () => setMenu((current) => current && { ...current, view: MENU_MOVE })
    const folder = menu.row?.kind === ROW_FOLDER ? menu.row.folder : null
    const context = {
      actions, tree, state: { folders, requests }, showMoveTargets, hasClipboard, editLabels: setLabelTarget,
      entries: selectedEntries, clearSelection, selectRow,
      isLinked: Boolean(folder) && Boolean(specLinks[folder.id]),
      isCollection: Boolean(folder) && isCollectionRoot(folders, folder.id, workspacePath),
      checksContract: Boolean(folder) && checksContract(specLinks[folder.id]),
      syncsSpec: Boolean(folder) && syncsSpec(specLinks[folder.id]),
    }
    return menuItemsFor(menu, context)
  }, [menu, tree, folders, requests, actions, specLinks, hasClipboard, workspacePath, selectedEntries, clearSelection, selectRow])

  const menuTitle = () => {
    if (menu.view !== MENU_MOVE) return ""
    return menu.owner ? TREE_TEXT.moveSelectionTitle(selectedEntries.length) : TREE_TEXT.moveTitle((menu.row.folder || menu.row.request).name)
  }

  const renderRow = (row) => {
    const dropPlace = dropPlaceFor(drag?.drop, row)
    if (row.kind === ROW_EMPTY) return <EmptyRow key={row.key} row={row} dropPlace={dropPlace} />
    const isFolder = row.kind === ROW_FOLDER
    const id = isFolder ? row.folder.id : row.request.id
    return (
      <TreeRow
        key={row.key}
        row={row}
        search={shownQuery}
        isActive={!isFolder && id === activeRequestId}
        isTabStop={row.key === tabStopKey}
        focusRequest={focusRequest?.key === row.key ? focusRequest.count : 0}
        isMenuOpen={menu?.row?.key === row.key}
        isMoving={isSource(drag?.source, row.kind, id) || (Boolean(drag?.source.group) && selected.has(row.key)) || (Boolean(treeClipboard?.cut) && isSource(treeClipboard, row.kind, id))}
        isSelected={selected.has(row.key)}
        dropPlace={dropPlace}
        onActivate={chooseRow}
        onPin={pinRow}
        onOpenMenu={openMenu}
        onPointerDown={startDrag}
        onKeyDown={handleKeyDown}
        onFocus={trackFocus}
      />
    )
  }

  const draggedRow = drag && rowsByKey.get(`${drag.source.kind}:${drag.source.id}`)
  const draggedName = drag?.source.group ? TREE_TEXT.dragCount(drag.source.group.length) : draggedRow && (draggedRow.folder || draggedRow.request).name
  const isDropAtRoot = drag?.drop?.kind === TARGET_ROOT

  return (
    <>
      <SearchField value={query} onChange={setQuery} onKeyDown={enterResultsOnArrow} placeholder={TREE_TEXT.searchPlaceholder} className="pe-1.5">
        <IconButton label={TREE_TEXT.collapseAll} icon={ChevronsDownUp} className="shrink-0" disabled={isSearching || folders.length === 0} onClick={collapseFolders} />
      </SearchField>

      {hasSelection && (
        <SelectionBar
          count={selected.size}
          onMove={(event) => openSelectionMenu(event, MENU_MOVE)}
          onDelete={() => actions.deleteItems(selectedEntries, clearSelection)}
          onClear={clearSelection}
        />
      )}

      <div className={cn("min-h-0 flex-1", isDropAtRoot && "ring-1 ring-inset ring-primary")}>
        {rows.length === 0 ? (
          <TreeEmptyState isSearching={isSearching} hasClipboard={hasClipboard} actions={actions} />
        ) : (
          <VirtualList role="tree" aria-multiselectable="true" aria-label={TREE_TEXT.treeLabel} items={rows} rowHeight={ROW_HEIGHT_PX} renderRow={renderRow} scrollRef={scrollRef} pinnedIndex={focusedRowIndex} className="h-full py-1" />
        )}
      </div>

      {drag && draggedName && <DragChip drag={drag} name={draggedName} />}

      {labelTarget && <LabelDialog target={labelTarget} actions={actions} onClose={closeLabels} />}

      {menu && (
        <ContextMenu
          position={menu.position}
          title={menuTitle()}
          items={menuItems}
          onClose={closeMenu}
        />
      )}
    </>
  )
})
