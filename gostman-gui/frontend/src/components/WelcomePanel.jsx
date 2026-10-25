import { ChevronRight, FolderOpen, FolderPlus, Import, Terminal, X } from "lucide-react"
import { GettingStartedChecklist, useOnboardingProgress } from "./GettingStarted"
import { IconButton } from "./ui/button"
import { focusAddress } from "../lib/panes"
import { usePreferences } from "../lib/preferences"
import { shortcutRows } from "../lib/shortcuts"
import { cn } from "../lib/utils"
import { SHORTCUT_IDS } from "../lib/welcome"
import { WELCOME_TEXT as TEXT } from "../lib/welcomeText"

const BOX = "rounded-md border border-border p-3"

function Section({ title, className, children }) {
  return (
    <section aria-label={title} className={cn(BOX, "flex flex-col gap-2", className)}>
      <h3 className="text-xs font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function ActionRow({ icon: Icon, title, hint, onClick }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-start transition-colors hover:bg-accent">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <span className="block text-xs font-medium leading-5">{title}</span>
          <span className="block text-xs text-muted-foreground">{hint}</span>
        </span>
        <ChevronRight aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground rtl:-scale-x-100" />
      </button>
    </li>
  )
}

function OtherWays({ actions }) {
  return (
    <Section title={TEXT.otherTitle}>
      <ul className="-mx-2 flex flex-col">
        <ActionRow icon={Import} title={TEXT.importTitle} hint={TEXT.importHint} onClick={actions.openImport} />
        {actions.storage && (
          <ActionRow icon={FolderOpen} title={TEXT.folderTitle} hint={TEXT.folderHint} onClick={actions.storage.openFolder} />
        )}
        <ActionRow icon={FolderPlus} title={TEXT.collectionTitle} hint={TEXT.collectionHint} onClick={() => actions.createFolder()} />
        <ActionRow icon={Terminal} title={TEXT.curlTitle} hint={TEXT.curlHint} onClick={focusAddress} />
      </ul>
    </Section>
  )
}

function Shortcuts() {
  const { shortcuts } = usePreferences()
  const rows = shortcutRows(shortcuts).filter((row) => SHORTCUT_IDS.includes(row.id) && row.keys)
  if (rows.length === 0) return null
  return (
    <Section title={TEXT.shortcutsTitle} className="max-sm:hidden">
      <dl className="grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-x-6 gap-y-2 py-2">
        {rows.map((row) => (
          <div key={row.id} className="contents">
            <dt className="text-xs [overflow-wrap:anywhere]">{row.label}</dt>
            <dd className="flex">
              <kbd className="flex-1 justify-center">{row.keys}</kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

export function WelcomePanel({ actions, onDismiss }) {
  const progress = useOnboardingProgress()

  return (
    <section aria-label={TEXT.title} data-pane="request" className="min-h-0 flex-1 overflow-y-auto border-t border-border">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 max-sm:py-4">
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold [text-wrap:balance]">{TEXT.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{TEXT.intro}</p>
          </div>
          <IconButton label={TEXT.dismiss} icon={X} onClick={onDismiss} />
        </header>

        <div className={BOX}>
          <GettingStartedChecklist progress={progress} onBegin={actions.beginOnboardingStep} />
        </div>

        <OtherWays actions={actions} />
        <Shortcuts />
      </div>
    </section>
  )
}
