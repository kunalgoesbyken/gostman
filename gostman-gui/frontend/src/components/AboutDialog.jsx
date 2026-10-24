import { Check, Copy } from "lucide-react"
import { Button } from "./ui/button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { useClipboardCopy } from "../hooks/useClipboardCopy"
import { ABOUT_LINKS, buildDiagnostics, openExternal } from "../lib/about"
import { ABOUT_TEXT as TEXT } from "../lib/aboutText"
import { usePreferences } from "../lib/preferences"
import { useAppStore } from "../store/appStore"
import { Logo } from "./ui/logo"

export function AboutDialog({ onClose }) {
  const requests = useAppStore((s) => s.requests)
  const folders = useAppStore((s) => s.folders)
  const environments = useAppStore((s) => s.environments)
  const { theme } = usePreferences()
  const diagnostics = buildDiagnostics({ version: __APP_VERSION__, requests, folders, environments, theme })
  const { copied, copy } = useClipboardCopy(diagnostics)

  return (
    <Dialog label={TEXT.title} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{TEXT.title}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Logo className="h-14 w-14" />
          <div className="min-w-0">
            <p className="font-brand text-base font-semibold">Gostman</p>
            <p className="font-mono text-xs text-muted-foreground">{TEXT.version(__APP_VERSION__)}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{TEXT.tagline}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {ABOUT_LINKS.map((link) => (
            <li key={link.id}>
              <a href={link.url} target="_blank" rel="noopener noreferrer" onClick={(event) => openExternal(event, link.url)} className="text-primary underline-offset-2 hover:underline">
                {TEXT.links[link.id]}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{TEXT.diagnosticsHint}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? TEXT.copied : TEXT.copyDiagnostics}
        </Button>
        <Button onClick={onClose}>{TEXT.close}</Button>
      </DialogFooter>
    </Dialog>
  )
}
