import { useState } from "react"
import { Button, buttonVariants } from "../ui/button"
import { cn } from "../../lib/utils"
import { detectBrowserOs } from "../../lib/detectOs"
import { Download, ChevronDown } from "./icons"
import { AppleIcon, WindowsIcon, LinuxIcon } from "../Icons"
import { DOWNLOADS, downloadFor, downloadUrl } from "./downloads"

const ICONS = { macos: AppleIcon, windows: WindowsIcon, linux: LinuxIcon }

const DOWNLOAD_OPTIONS = DOWNLOADS.map((download) => ({
  ...download,
  icon: ICONS[download.os],
  desc: `${download.note} (${download.kind})`,
}))

const LARGE = "gap-3 text-lg py-6"

function DownloadMenu({ onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute top-full left-0 mt-2 z-20 min-w-[280px] text-left rounded-lg border border-border bg-background shadow-xl overflow-hidden">
        {DOWNLOAD_OPTIONS.map((option) => (
          <a
            key={option.file}
            href={downloadUrl(option)}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0"
            onClick={onClose}
          >
            <option.icon className="h-5 w-5 text-foreground/90" />
            <div className="flex-1">
              <div className="font-semibold">{option.name}</div>
              <div className="text-xs text-muted-foreground">{option.desc}</div>
            </div>
            <Download className="h-4 w-4 text-muted-foreground" />
          </a>
        ))}
      </div>
    </>
  )
}

export const DownloadDropdown = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [primary] = useState(() => downloadFor(detectBrowserOs()))
  const toggle = () => setIsOpen((open) => !open)

  return (
    <div className="relative z-30 flex">
      {primary ? (
        <>
          <a href={downloadUrl(primary)} className={cn(buttonVariants({ size: "lg" }), LARGE, "flex-1 px-8 rounded-r-none")}>
            <Download className="h-5 w-5" />
            Download for {primary.name}
          </a>
          <Button
            size="lg"
            className={cn(LARGE, "px-3 rounded-l-none border-l border-primary-foreground/20")}
            aria-label="Other downloads"
            aria-expanded={isOpen}
            onClick={toggle}
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        </>
      ) : (
        <Button size="lg" className={cn(LARGE, "flex-1 px-8")} aria-expanded={isOpen} onClick={toggle}>
          <Download className="h-5 w-5" />
          Download for Desktop
          <ChevronDown className="h-5 w-5" />
        </Button>
      )}

      {isOpen && <DownloadMenu onClose={() => setIsOpen(false)} />}
    </div>
  )
}
