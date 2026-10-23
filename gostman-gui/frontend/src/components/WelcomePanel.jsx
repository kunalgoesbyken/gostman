import { FolderOpen, FolderPlus, Import, Terminal, X } from "lucide-react"
import { GettingStartedChecklist, useOnboardingProgress } from "./GettingStarted"
import { Button, IconButton } from "./ui/button"
import { SectionLabel } from "./ui/panel"
import { usePreferences } from "../lib/preferences"
import { shortcutRows } from "../lib/shortcuts"
import { SHORTCUT_IDS } from "../lib/welcome"
import { WELCOME_TEXT as TEXT } from "../lib/welcomeText"

function Card({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <h3 className="text-xs font-semibold">{title}</h3>
      </div>
      <p className="flex-1 text-xs text-muted-foreground">{hint}</p>
      {action}
    </div>
  )
}

function Shortcuts() {
  const { shortcuts } = usePreferences()
  const rows = shortcutRows(shortcuts).filter((row) => SHORTCUT_IDS.includes(row.id) && row.keys)
  return (
    <section aria-label={TEXT.shortcutsTitle} className="min-w-0">
      <SectionLabel className="mb-2 block">{TEXT.shortcutsTitle}</SectionLabel>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate">{row.label}</span>
            <kbd>{row.keys}</kbd>
          </li>
        ))}
      </ul>
    </section>
  )
}

function VariableHint() {
  return (
    <section aria-label={TEXT.variablesTitle} className="min-w-0">
      <SectionLabel className="mb-2 block">{TEXT.variablesTitle}</SectionLabel>
      <p className="mb-2 flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="gm-var-ok px-1">{TEXT.definedExample}</span>
        <span className="gm-var-missing px-1">{TEXT.missingExample}</span>
      </p>
      <p className="text-xs text-muted-foreground">{TEXT.variablesHint}</p>
    </section>
  )
}

export function WelcomePanel({ actions, onDismiss }) {
  const canOpenFolder = Boolean(actions.storage)
  const progress = useOnboardingProgress()

  return (
    <section aria-label={TEXT.title} data-pane="request" className="min-h-0 flex-1 overflow-y-auto border-t border-border">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">{TEXT.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{TEXT.intro}</p>
          </div>
          <IconButton label={TEXT.dismiss} icon={X} onClick={onDismiss} />
        </div>

        <div className="rounded-md border border-border p-3">
          <GettingStartedChecklist progress={progress} onBegin={actions.beginOnboardingStep} />
        </div>

        <SectionLabel className="-mb-2 block">{TEXT.existingTitle}</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card
            icon={Import}
            title={TEXT.importTitle}
            hint={TEXT.importHint}
            action={<Button variant="outline" onClick={actions.openImport}>{TEXT.importAction}</Button>}
          />
          {canOpenFolder && (
            <Card
              icon={FolderOpen}
              title={TEXT.folderTitle}
              hint={TEXT.folderHint}
              action={<Button variant="outline" onClick={actions.storage.openFolder}>{TEXT.folderAction}</Button>}
            />
          )}
          <Card
            icon={FolderPlus}
            title={TEXT.collectionTitle}
            hint={TEXT.collectionHint}
            action={<Button variant="outline" onClick={() => actions.createFolder()}>{TEXT.collectionAction}</Button>}
          />
          <Card icon={Terminal} title={TEXT.curlTitle} hint={TEXT.curlHint} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Shortcuts />
          <VariableHint />
        </div>
      </div>
    </section>
  )
}
