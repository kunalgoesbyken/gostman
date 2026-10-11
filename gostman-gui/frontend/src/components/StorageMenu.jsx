import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronDown, Folder, FolderOpen, HardDrive, History, RefreshCw, Save, X } from "lucide-react"
import { Button } from "./ui/button"
import { ContextMenu } from "./ui/ContextMenu"
import { pluralize } from "../lib/dataUtils"
import { useAppStore } from "../store/appStore"

const LOCAL_LABEL = "This computer"
const LOCAL_HINT = "The collection is saved in the app's data on this computer"
const BROWSER_LABEL = "This browser"
const BROWSER_HINT = "The collection is saved in this browser. Keeping it as files in a folder needs the desktop app."
const NO_FOLDER = { path: "", name: "", recent: [], problems: [] }
const BUTTON_CLASS = "min-w-0 max-w-[14rem] shrink"

const messageOf = (error) => error?.message || String(error)

function menuItems(status, storage) {
  const hasFolder = status.path !== ""
  const recent = status.recent.map(({ path, name }) => ({
    id: `recent:${path}`,
    label: `Reopen ${name}`,
    icon: History,
    onSelect: () => storage.reopen(path),
  }))
  const problems = status.problems.length === 0 ? [] : [{
    id: "problems",
    label: `Show ${pluralize(status.problems.length, "unreadable file")}`,
    icon: AlertTriangle,
    onSelect: () => storage.showProblems(status.problems),
  }]
  return [
    { id: "open", label: "Open folder", icon: FolderOpen, onSelect: storage.openFolder },
    { id: "save", label: "Save collection to folder", icon: Save, onSelect: storage.saveToFolder },
    { id: "reload", label: "Reload from disk", icon: RefreshCw, disabled: !hasFolder, onSelect: storage.reload },
    ...problems,
    ...recent,
    { id: "close", label: "Close folder", icon: X, disabled: !hasFolder, onSelect: storage.close },
  ]
}

function useStorageStatus(storage) {
  const [status, setStatus] = useState(NO_FOLDER)
  const showAlert = useAppStore((s) => s.showAlert)

  useEffect(() => {
    const adopt = (current) => {
      setStatus(current)
      if (current.notice) showAlert("Folder not available", current.notice, "OK", "warning")
    }
    const fail = (error) => showAlert("Could not read the list of folders", messageOf(error), "OK", "warning")
    storage.status().then(adopt).catch(fail)
  }, [storage, showAlert])

  return status
}

function BrowserStorage() {
  const showAlert = useAppStore((s) => s.showAlert)
  return (
    <Button variant="ghost" title={BROWSER_HINT} onClick={() => showAlert(BROWSER_LABEL, BROWSER_HINT)} className={BUTTON_CLASS}>
      <HardDrive />
      <span className="truncate">{BROWSER_LABEL}</span>
    </Button>
  )
}

function FolderStorage({ storage }) {
  const status = useStorageStatus(storage)
  const [menuPosition, setMenuPosition] = useState(null)
  const items = useMemo(() => menuItems(status, storage), [status, storage])
  const closeMenu = useCallback(() => setMenuPosition(null), [])

  const openMenuBelowButton = (event) => {
    const { left, bottom } = event.currentTarget.getBoundingClientRect()
    setMenuPosition({ x: left, y: bottom })
  }

  const hasFolder = status.path !== ""
  const Icon = hasFolder ? Folder : HardDrive

  return (
    <>
      <Button
        variant="ghost"
        aria-haspopup="menu"
        aria-expanded={menuPosition !== null}
        title={status.path || LOCAL_HINT}
        onClick={openMenuBelowButton}
        className={BUTTON_CLASS}
      >
        <Icon />
        <span className="truncate">{hasFolder ? status.name : LOCAL_LABEL}</span>
        {status.problems.length > 0 && <AlertTriangle className="text-warning" />}
        <ChevronDown />
      </Button>
      {menuPosition && <ContextMenu position={menuPosition} title="" items={items} onClose={closeMenu} />}
    </>
  )
}

export function StorageMenu({ storage }) {
  return storage ? <FolderStorage storage={storage} /> : <BrowserStorage />
}
