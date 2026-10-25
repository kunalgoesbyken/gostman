import { memo, useLayoutEffect, useRef } from "react"
import { inlineStart } from "../hooks/direction"
import { ChevronDown, ChevronRight, Folder, MoreHorizontal } from "lucide-react"
import { IconButton } from "./ui/button"
import { MethodTag } from "./MethodTag"
import { TagBadge } from "./TagBadge"
import { MarkedRanges } from "./HighlightedText"
import { ROW_FOLDER } from "../lib/collectionTree"
import { matchRanges } from "../lib/textMatch"
import { shownMethod } from "../lib/methodLabel"
import { PLACE_AFTER, PLACE_BEFORE, PLACE_INSIDE } from "../lib/dropPlace"
import { normalizeTags } from "../lib/tags"
import { colorHex } from "../lib/swatches"
import { TREE_TEXT } from "../lib/treeText"
import { cn } from "../lib/utils"

export const ROW_HEIGHT_PX = 28
const INDENT_STEP_PX = 12
const BASE_PADDING_PX = 12
const MAX_INDENT_LEVELS = 10
const SHOWN_TAGS = 2
const FOLDER_FILL_OPACITY = 0.3

const indentOf = (depth) => BASE_PADDING_PX + Math.min(depth, MAX_INDENT_LEVELS) * INDENT_STEP_PX

function DropLine({ place }) {
  if (place !== PLACE_BEFORE && place !== PLACE_AFTER) return null
  return <span aria-hidden className={cn("pointer-events-none absolute inset-x-0 h-0.5 bg-primary", place === PLACE_BEFORE ? "top-0" : "bottom-0")} />
}

function RowTags({ tags }) {
  if (tags.length === 0) return null
  const hidden = tags.length - SHOWN_TAGS

  return (
    <span className="flex min-w-0 max-w-[50%] shrink items-center gap-1 ps-1">
      {tags.slice(0, SHOWN_TAGS).map((tag) => <TagBadge key={tag} tag={tag} className="px-1 text-3xs leading-4" />)}
      {hidden > 0 && (
        <>
          <span aria-hidden="true" className="shrink-0 text-3xs text-muted-foreground">{TREE_TEXT.moreTags(hidden)}</span>
          <span className="sr-only">{tags.slice(SHOWN_TAGS).join(", ")}</span>
        </>
      )}
    </span>
  )
}

function FolderIcon({ color }) {
  const hex = colorHex(color)
  if (!hex) return <Folder className="h-3.5 w-3.5 shrink-0" />
  return <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: hex }} fill={hex} fillOpacity={FOLDER_FILL_OPACITY} />
}

export const EmptyRow = memo(function EmptyRow({ row, dropPlace }) {
  return (
    <div
      data-row-key={row.key}
      style={{ height: ROW_HEIGHT_PX, paddingLeft: indentOf(row.depth) + 20 }}
      className={cn("flex items-center text-xs text-muted-foreground", dropPlace === PLACE_INSIDE && "bg-accent")}
    >
      {TREE_TEXT.emptyFolder}
    </div>
  )
})

export const TreeRow = memo(function TreeRow({ row, search, isActive, isTabStop, focusRequest, isMenuOpen, isMoving, isSelected, dropPlace, onActivate, onPin, onOpenMenu, onPointerDown, onKeyDown, onFocus }) {
  const isFolder = row.kind === ROW_FOLDER
  const item = isFolder ? row.folder : row.request
  const name = item.name || TREE_TEXT.untitled
  const tags = normalizeTags(item.tags)
  const Chevron = row.isOpen ? ChevronDown : ChevronRight
  const mainRef = useRef(null)

  useLayoutEffect(() => {
    if (focusRequest) mainRef.current.focus()
  }, [focusRequest])

  const openMenuAtPointer = (event) => {
    event.preventDefault()
    onOpenMenu(row, { x: event.clientX, y: event.clientY })
  }
  const openMenuBelowButton = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    onOpenMenu(row, { x: inlineStart(rect), y: rect.bottom })
  }

  return (
    <div
      role="none"
      data-row-key={row.key}
      onContextMenu={openMenuAtPointer}
      onKeyDown={(event) => onKeyDown(event, row)}
      onFocus={() => onFocus(row)}
      style={{ height: ROW_HEIGHT_PX }}
      className={cn(
        "group relative flex select-none items-center pe-1.5 text-xs [-webkit-touch-callout:none]",
        isSelected ? "bg-primary/15 text-foreground" : isActive || isMenuOpen || dropPlace === PLACE_INSIDE ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
        dropPlace === PLACE_INSIDE && "ring-1 ring-inset ring-primary",
        isMoving && "opacity-50"
      )}
    >
      <DropLine place={dropPlace} />
      <button
        ref={mainRef}
        type="button"
        role="treeitem"
        aria-expanded={isFolder ? row.isOpen : undefined}
        aria-selected={isSelected || isActive}
        aria-level={row.depth + 1}
        aria-posinset={row.position}
        aria-setsize={row.siblings}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Control+C Control+X Control+V Control+D Control+Z Control+Shift+Z F2 Delete Shift+F10"
        data-row-main
        data-pane-entry
        tabIndex={isTabStop ? 0 : -1}
        onClick={(event) => onActivate(row, event)}
        onDoubleClick={() => onPin(row)}
        onPointerDown={(event) => onPointerDown(event, row)}
        title={[name, !isFolder && item.url, tags.join(", ")].filter(Boolean).join("\n")}
        style={{ paddingLeft: indentOf(row.depth) }}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-start"
      >
        {isFolder ? (
          <>
            <Chevron className="h-3.5 w-3.5 shrink-0 rtl:-scale-x-100" />
            <FolderIcon color={item.color} />
          </>
        ) : (
          <MethodTag compact method={shownMethod(item)} className="w-10" />
        )}
        <span className={cn("min-w-0 flex-1 truncate", isFolder && "font-medium text-foreground")}>
          {isFolder ? name : <MarkedRanges text={name} ranges={matchRanges(name, search)} />}
        </span>
        <RowTags tags={tags} />
      </button>
      <IconButton
        label={TREE_TEXT.actionsFor(name)}
        icon={MoreHorizontal}
        size="icon-xs"
        data-row-action
        tabIndex={-1}
        aria-haspopup="menu"
        onClick={openMenuBelowButton}
        className={cn("hover:bg-muted", !isMenuOpen && "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100")}
      />
    </div>
  )
})
