import { useCallback, useRef, useState } from "react"
import { Button, buttonVariants } from "../ui/button"
import { cn } from "../../lib/utils"
import { Download, ChevronDown, ArrowUpRight } from "./icons"
import { AppleIcon, WindowsIcon, LinuxIcon } from "../Icons"
import { DOWNLOADS, downloadUrl, groupByOs, isExternal } from "./downloads"
import { usePopoverDismiss } from "../../hooks/usePopoverDismiss"

const ICONS = { macos: AppleIcon, windows: WindowsIcon, linux: LinuxIcon }

const GROUPS = groupByOs(DOWNLOADS)

const LARGE = "gap-3 text-lg py-6"

const ROW = "flex items-center gap-3 px-4 hover:bg-muted/40 transition-colors"

function DownloadLink({ download, onClose, className, children }) {
  const external = isExternal(download)
  const Trailing = external ? ArrowUpRight : Download
  return (
    <a
      href={downloadUrl(download)}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={cn(ROW, className)}
      onClick={onClose}
    >
      {children}
      <span className="font-mono text-xs text-muted-foreground">{download.kind}</span>
      <Trailing className="h-4 w-4 text-muted-foreground" />
    </a>
  )
}

function DownloadGroup({ group, onClose }) {
  const Icon = ICONS[group.os]
  const [first] = group.downloads

  if (group.downloads.length === 1) {
    return (
      <DownloadLink download={first} onClose={onClose} className="py-3">
        <Icon className="h-5 w-5 text-foreground/90" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{group.name}</div>
          <div className="text-xs text-muted-foreground">{first.note}</div>
        </div>
      </DownloadLink>
    )
  }

  return (
    <div className="pb-1.5">
      <div className="flex items-center gap-3 px-4 pb-1 pt-3">
        <Icon className="h-5 w-5 text-foreground/90" />
        <div className="font-semibold">{group.name}</div>
      </div>
      {group.downloads.map((download) => (
        <DownloadLink key={download.kind} download={download} onClose={onClose} className="py-2 pl-12">
          <span className="min-w-0 flex-1 text-sm text-muted-foreground">{download.note}</span>
        </DownloadLink>
      ))}
    </div>
  )
}

function DownloadMenu({ toggleRef, onClose }) {
  const menuRef = useRef(null)
  usePopoverDismiss(menuRef, toggleRef, onClose)
  return (
    <div
      ref={menuRef}
      className="absolute top-full left-0 right-0 mt-2 z-20 min-w-[280px] sm:right-auto text-left rounded-lg border border-border bg-background shadow-xl overflow-hidden divide-y divide-border/30"
    >
      {GROUPS.map((group) => (
        <DownloadGroup key={group.os} group={group} onClose={onClose} />
      ))}
    </div>
  )
}

export const DownloadDropdown = ({ primary, variant }) => {
  const [isOpen, setIsOpen] = useState(false)
  const toggleRef = useRef(null)
  const toggle = () => setIsOpen((open) => !open)
  const close = useCallback(() => setIsOpen(false), [])

  return (
    <div className="relative z-30 flex">
      {primary ? (
        <>
          <a href={downloadUrl(primary)} className={cn(buttonVariants({ size: "lg", variant }), LARGE, "min-w-0 flex-1 rounded-r-none px-5 sm:px-8")}>
            <Download className="h-5 w-5" />
            Download for {primary.name}
          </a>
          <Button
            ref={toggleRef}
            size="lg"
            variant={variant}
            className={cn(LARGE, "px-3 rounded-l-none border-l border-primary-foreground/20")}
            aria-label="Other downloads"
            aria-expanded={isOpen}
            onClick={toggle}
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        </>
      ) : (
        <Button ref={toggleRef} size="lg" variant={variant} className={cn(LARGE, "flex-1 px-5 sm:px-8")} aria-expanded={isOpen} onClick={toggle}>
          <Download className="h-5 w-5" />
          Download for Desktop
          <ChevronDown className="h-5 w-5" />
        </Button>
      )}

      {isOpen && <DownloadMenu toggleRef={toggleRef} onClose={close} />}
    </div>
  )
}
