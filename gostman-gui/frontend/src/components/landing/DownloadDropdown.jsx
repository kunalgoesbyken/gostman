
import React, { useState } from "react"
import { Button } from "../ui/button"
import { Download, ChevronDown } from "./icons"
import { AppleIcon, WindowsIcon, LinuxIcon } from "../Icons"

import { DOWNLOADS, downloadUrl } from "./downloads"

const ICONS = { macos: AppleIcon, windows: WindowsIcon, linux: LinuxIcon }

const DOWNLOAD_OPTIONS = DOWNLOADS.map((download) => ({
    ...download,
    icon: ICONS[download.os],
    desc: `${download.note} (${download.kind})`,
}))

export const DownloadDropdown = () => {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="relative z-30">
            <Button
                size="lg"
                className="gap-3 text-lg px-8 py-6"
                onClick={() => setIsOpen(!isOpen)}
            >
                <Download className="h-5 w-5" />
                Download for Desktop
                <ChevronDown className="h-5 w-5" />
            </Button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 z-20 min-w-[280px] text-left rounded-lg border border-border bg-background shadow-xl overflow-hidden">
                        {DOWNLOAD_OPTIONS.map((option) => (
                            <a
                                key={option.file}
                                href={downloadUrl(option)}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0"
                                onClick={() => setIsOpen(false)}
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
            )}
        </div>
    )
}
