
import React, { useState } from "react"
import { Button } from "../ui/button"
import { Download, ChevronDown } from "lucide-react"
import { AppleIcon, WindowsIcon, LinuxIcon } from "../Icons"

const DOWNLOAD_OPTIONS = [
    {
        os: "macOS",
        desc: "Universal Binary (Intel + Apple Silicon)",
        icon: AppleIcon,
        href: "https://github.com/krockxz/gostman/releases/latest/download/Gostman-darwin-universal.zip",
        iconColor: "text-foreground/90"
    },
    {
        os: "Windows",
        desc: "64-bit Installer",
        icon: WindowsIcon,
        href: "https://github.com/krockxz/gostman/releases/latest/download/Gostman-windows-amd64.exe",
        iconColor: "text-foreground/90"
    },
    {
        os: "Linux",
        desc: "Linux Binary (64-bit)",
        icon: LinuxIcon,
        href: "https://github.com/krockxz/gostman/releases/latest/download/Gostman-linux-amd64.zip",
        iconColor: "text-foreground/90"
    },
]

export const DownloadDropdown = () => {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="relative">
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
                    <div className="absolute top-full left-0 mt-2 z-20 min-w-[280px] rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06),0_16px_40px_-12px_hsl(var(--background))] overflow-hidden">
                        {DOWNLOAD_OPTIONS.map((option) => (
                            <a
                                key={option.os}
                                href={option.href}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-primary/10 transition-colors border-b border-border/30 last:border-0"
                                onClick={() => setIsOpen(false)}
                            >
                                <option.icon className={`h-5 w-5 ${option.iconColor}`} />
                                <div className="flex-1">
                                    <div className="font-semibold">{option.os}</div>
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
