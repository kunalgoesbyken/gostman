import { memo, useLayoutEffect, useRef } from "react"
import { ChevronDown, ChevronRight, Folder, MoreHorizontal } from "lucide-react"
import { IconButton } from "./ui/button"
import { MethodTag } from "./MethodTag"
import { ROW_FOLDER } from "../lib/collectionTree"
import { PLACE_AFTER, PLACE_BEFORE, PLACE_INSIDE } from "../lib/dropPlace"
import { TREE_TEXT } from "../lib/treeText"
import { cn } from "../lib/utils"

export const ROW_HEIGHT_PX = 28
const INDENT_STEP_PX = 12
const BASE_PADDING_PX = 12
const MAX_INDENT_LEVELS = 10
const UNTITLED = "Untitled"

const indentOf = (depth) => BASE_PADDING_PX + Math.min(depth, MAX_INDENT_LEVELS) * INDENT_STEP_PX

function DropLine({ place }) {
  if (place !== PLACE_BEFORE && place !== PLACE_AFTER) return null
  return <span aria-hidden className={cn("pointer-events-none absolute inset-x-0 h-0.5 bg-primary", place === PLACE_BEFORE ? "top-0" : "bottom-0")} />
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

export const TreeRow = memo(function TreeRow({ row, isActive, isTabStop, focusRequest, isMenuOpen, isDragged, dropPlace, onActivate, onPin, onOpenMenu, onPointerDown, onKeyDown, onFocus }) {
  const isFolder = row.kind === ROW_FOLDER
  const item = isFolder ? row.folder : row.request
  const name = item.name || UNTITLED
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
    const { left, bottom } = event.currentTarget.getBoundingClientRect()
    onOpenMenu(row, { x: left, y: bottom })
  }

  return (
    <div
      role="treeitem"
      data-row-key={row.key}
      aria-expanded={isFolder ? row.isOpen : undefined}
      aria-selected={isActive}
      aria-level={row.depth + 1}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Control+C Control+V Control+D F2 Delete Shift+F10"
      onContextMenu={openMenuAtPointer}
      onKeyDown={(event) => onKeyDown(event, row)}
      onFocus={() => onFocus(row)}
      style={{ height: ROW_HEIGHT_PX }}
      className={cn(
        "group relative flex select-none items-center pr-1.5 text-xs [-webkit-touch-callout:none]",
        isActive || isMenuOpen || dropPlace === PLACE_INSIDE ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
        dropPlace === PLACE_INSIDE && "ring-1 ring-inset ring-primary",
        isDragged && "opacity-50"
      )}
    >
      <DropLine place={dropPlace} />
      <button
        ref={mainRef}
        type="button"
        data-row-main
        data-pane-entry
        tabIndex={isTabStop ? 0 : -1}
        onClick={() => onActivate(row)}
        onDoubleClick={() => onPin(row)}
        onPointerDown={(event) => onPointerDown(event, row)}
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
        data-row-action
        tabIndex={-1}
        aria-haspopup="menu"
        onClick={openMenuBelowButton}
        className={cn("hover:bg-muted", !isMenuOpen && "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100")}
      />
    </div>
  )
})
