import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AlertTriangle, Check, Download, ExternalLink, Folder, FolderOpen, GitBranch, HardDrive, Pencil, Pin, PinOff, RefreshCw, Save, ShieldCheck, Trash2, X } from "lucide-react"
import { IconButton } from "./ui/button"
import { SectionLabel } from "./ui/panel"
import { pluralize } from "../lib/dataUtils"
import { openGit } from "../lib/gitSession"
import { WORKSPACE_TEXT as TEXT } from "../lib/workspaceText"
import { cn } from "../lib/utils"

const VIEWPORT_MARGIN = 8
const FOCUS_STEPS = { ArrowDown: 1, ArrowUp: -1 }

const clamp = (start, size, viewport) => Math.max(VIEWPORT_MARGIN, Math.min(start, viewport - size - VIEWPORT_MARGIN))

function WorkspaceRow({ entry, storage, onClose }) {
  const Icon = entry.current ? Check : Folder
  const select = () => {
    onClose()
    if (!entry.current) storage.reopen(entry.path)
  }
  const closeThen = (run) => {
    onClose()
    run()
  }
  return (
    <div role="presentation" className={cn("group flex items-center gap-1 pl-3 pr-1 hover:bg-accent", entry.current && "bg-accent/60")}>
      <button
        type="button"
        role="menuitem"
        title={entry.path}
        aria-current={entry.current ? "true" : undefined}
        onClick={select}
        className="flex h-10 min-w-0 flex-1 items-center gap-2 text-left"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{entry.name}</span>
          <span className={cn("block truncate text-2xs", entry.missing ? "text-warning" : "text-muted-foreground")}>
            {entry.missing ? TEXT.missing : entry.path}
          </span>
        </span>
      </button>
      <IconButton
        size="icon-xs"
        label={`${entry.pinned ? TEXT.unpin : TEXT.pin}: ${entry.name}`}
        icon={entry.pinned ? PinOff : Pin}
        onClick={() => storage.pin(entry.path, !entry.pinned)}
      />
      <IconButton size="icon-xs" label={`${TEXT.rename}: ${entry.name}`} icon={Pencil} onClick={() => closeThen(() => storage.promptRename(entry))} />
      {!entry.missing && <IconButton size="icon-xs" label={`${TEXT.reveal}: ${entry.name}`} icon={ExternalLink} onClick={() => closeThen(() => storage.reveal(entry.path))} />}
      {!entry.current && <IconButton size="icon-xs" label={`${TEXT.forget}: ${entry.name}`} icon={Trash2} onClick={() => closeThen(() => storage.confirmForget(entry))} />}
    </div>
  )
}

function ComputerRow({ isCurrent, storage, onClose }) {
  const select = () => {
    onClose()
    if (!isCurrent) storage.close()
  }
  return (
    <button
      type="button"
      role="menuitem"
      title={TEXT.localHint}
      aria-current={isCurrent ? "true" : undefined}
      onClick={select}
      className={cn("flex h-10 w-full items-center gap-2 px-3 text-left hover:bg-accent", isCurrent && "bg-accent/60")}
    >
      {isCurrent ? <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <HardDrive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      <span className="truncate text-xs font-medium">{TEXT.thisComputer}</span>
    </button>
  )
}

function ActionRow({ action, onClose }) {
  const Icon = action.icon
  const run = () => {
    onClose()
    action.run()
  }
  return (
    <button type="button" role="menuitem" disabled={action.disabled} onClick={run} className="flex h-8 w-full items-center gap-2 px-3 text-left text-xs hover:bg-accent disabled:pointer-events-none disabled:opacity-40">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{action.label}</span>
    </button>
  )
}

function footerActions(status, storage, isRestricted) {
  const hasFolder = status.path !== ""
  const problems = status.problems.length === 0 ? [] : [{
    id: "problems",
    label: TEXT.problems(pluralize(status.problems.length, "unreadable file")),
    icon: AlertTriangle,
    run: () => storage.showProblems(status.problems),
  }]
  const trust = isRestricted ? [{ id: "trust", label: TEXT.trust, icon: ShieldCheck, run: storage.confirmTrust }] : []
  return [
    ...trust,
    { id: "open", label: TEXT.openFolder, icon: FolderOpen, run: storage.openFolder },
    { id: "save", label: TEXT.saveToFolder, icon: Save, run: storage.saveToFolder },
    { id: "clone", label: TEXT.clone, icon: Download, run: storage.promptClone },
    { id: "git", label: TEXT.git, icon: GitBranch, disabled: !hasFolder, run: openGit },
    { id: "reload", label: TEXT.reload, icon: RefreshCw, disabled: !hasFolder, run: storage.reload },
    ...problems,
    { id: "close", label: TEXT.close, icon: X, disabled: !hasFolder, run: storage.close },
  ]
}

function groupsOf(workspaces) {
  const pinned = workspaces.filter((entry) => entry.pinned)
  const recent = workspaces.filter((entry) => !entry.pinned)
  return [
    { id: "pinned", title: TEXT.pinned, entries: pinned },
    { id: "recent", title: TEXT.recent, entries: recent },
  ].filter((group) => group.entries.length > 0)
}

export function WorkspaceMenu({ anchor, status, storage, isRestricted, onClose }) {
  const menuRef = useRef(null)
  const [placement, setPlacement] = useState(null)
  const groups = groupsOf(status.workspaces)

  useLayoutEffect(() => {
    const { width, height } = menuRef.current.getBoundingClientRect()
    setPlacement({ left: clamp(anchor.x, width, window.innerWidth), top: clamp(anchor.y, height, window.innerHeight) })
    menuRef.current.querySelector("button[aria-current], button:not(:disabled)")?.focus()
  }, [anchor])

  useEffect(() => {
    const closeWhenOutside = (event) => {
      if (!menuRef.current.contains(event.target)) onClose()
    }
    window.addEventListener("mousedown", closeWhenOutside)
    window.addEventListener("resize", onClose)
    return () => {
      window.removeEventListener("mousedown", closeWhenOutside)
      window.removeEventListener("resize", onClose)
    }
  }, [onClose])

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      onClose()
      return
    }
    const step = FOCUS_STEPS[event.key]
    if (!step) return
    event.preventDefault()
    const buttons = Array.from(menuRef.current.querySelectorAll("button:not(:disabled)"))
    const current = buttons.indexOf(document.activeElement)
    buttons[(current + step + buttons.length) % buttons.length]?.focus()
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={TEXT.switcherLabel}
      onKeyDown={handleKeyDown}
      style={placement || { left: 0, top: 0, visibility: "hidden" }}
      className="fixed z-50 flex max-h-[min(32rem,calc(100dvh-4rem))] w-[min(23rem,calc(100vw-1rem))] flex-col overflow-y-auto rounded-md border border-border bg-background py-1 shadow-lg"
    >
      <ComputerRow isCurrent={status.path === ""} storage={storage} onClose={onClose} />
      {groups.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">{TEXT.noWorkspaces}</p>}
      {groups.map((group) => (
        <div key={group.id} role="presentation">
          <SectionLabel className="block truncate px-3 pb-1 pt-2">{group.title}</SectionLabel>
          {group.entries.map((entry) => <WorkspaceRow key={entry.path} entry={entry} storage={storage} onClose={onClose} />)}
        </div>
      ))}
      <div role="presentation" className="mt-1 border-t border-border pt-1">
        {footerActions(status, storage, isRestricted).map((action) => <ActionRow key={action.id} action={action} onClose={onClose} />)}
      </div>
    </div>,
    document.body
  )
}
