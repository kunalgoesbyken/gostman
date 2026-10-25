import { useCallback, useEffect, useRef } from "react"
import { AlertTriangle, ChevronDown, Folder, HardDrive, ShieldAlert } from "lucide-react"
import { Button } from "./ui/button"
import { GitPanel } from "./GitPanel"
import { WorkspaceMenu } from "./WorkspaceMenu"
import { useShortcutLabel } from "../hooks/useShortcuts"
import { hintWithShortcut } from "../lib/shortcuts"
import { WORKSPACE_TEXT as TEXT } from "../lib/workspaceText"
import { useAppStore } from "../store/appStore"

const BUTTON_CLASS = "min-w-0 max-w-[14rem] shrink"

const keepMenuOpenState = (event) => event.stopPropagation()

function useGitState(git, path) {
  const requests = useAppStore((s) => s.requests)
  const folders = useAppStore((s) => s.folders)

  useEffect(() => {
    const refresh = () => git.refreshState().catch(() => {})
    window.addEventListener("focus", refresh)
    return () => window.removeEventListener("focus", refresh)
  }, [git])

  useEffect(() => {
    git.refreshState().catch(() => {})
  }, [git, path, requests, folders])
}

function BrowserStorage() {
  const showAlert = useAppStore((s) => s.showAlert)
  return (
    <Button variant="ghost" title={TEXT.browserHint} onClick={() => showAlert(TEXT.browserLabel, TEXT.browserHint)} className={BUTTON_CLASS}>
      <HardDrive />
      <span className="truncate max-sm:sr-only">{TEXT.browserLabel}</span>
    </Button>
  )
}

function FolderStorage({ storage }) {
  const status = useAppStore((s) => s.workspaceStatus)
  const isOpen = useAppStore((s) => s.workspaceMenuOpen)
  const setOpen = useAppStore((s) => s.setWorkspaceMenuOpen)
  const isRestricted = useAppStore((s) => s.isRestricted)
  const buttonRef = useRef(null)
  const shortcut = useShortcutLabel("workspaceSwitcher")
  const { refresh } = storage
  useGitState(storage.git, status.path)

  useEffect(() => {
    refresh()
  }, [refresh])

  const closeMenu = useCallback(() => setOpen(false), [setOpen])

  const hasFolder = status.path !== ""
  const Icon = hasFolder ? Folder : HardDrive
  const rect = isOpen ? buttonRef.current?.getBoundingClientRect() : null
  const title = isRestricted ? TEXT.restrictedHint : hintWithShortcut(status.path || TEXT.localHint, shortcut)

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`${TEXT.switcherLabel}: ${hasFolder ? status.name : TEXT.localLabel}`}
        title={title}
        onMouseDown={keepMenuOpenState}
        onClick={() => setOpen(!isOpen)}
        className={BUTTON_CLASS}
      >
        <Icon />
        <span className="truncate max-sm:sr-only">{hasFolder ? status.name : TEXT.localLabel}</span>
        {isRestricted && <ShieldAlert className="text-warning" />}
        {status.problems.length > 0 && <AlertTriangle className="text-warning" />}
        <ChevronDown />
      </Button>
      {rect && <WorkspaceMenu anchor={{ x: rect.left, y: rect.bottom }} status={status} storage={storage} isRestricted={isRestricted} onClose={closeMenu} />}
      <GitPanel actions={storage.git} onTrust={storage.confirmTrust} />
    </>
  )
}

export function StorageMenu({ storage }) {
  return storage ? <FolderStorage storage={storage} /> : <BrowserStorage />
}
