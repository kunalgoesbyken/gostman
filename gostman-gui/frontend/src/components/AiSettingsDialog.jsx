import { useState } from "react"
import { Check } from "lucide-react"
import { BrandIcon } from "./ui/brandIcon"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { Select } from "./ui/select"
import { Skeleton } from "./ui/skeleton"
import { PROVIDERS, hostOf, providerById } from "../lib/ai/providers"
import { useAiStore } from "../lib/ai/session"

const BROWSER_NOTE = "In the browser, calls go straight from this page to the provider; your key never reaches Gostman servers. The provider must allow cross-origin calls. A local Ollama needs OLLAMA_ORIGINS set to this site. If a provider blocks browsers, use the desktop app."
const DESKTOP_NOTE = "Your key is kept in the OS keychain and the desktop app calls the provider itself. The page never reads the key back."
const OFF_NOTE = "AI is off until you turn it on here. Nothing is sent anywhere without a preview of exactly what leaves your machine."

function KeyField({ actions, keyStored, provider }) {
  const [draft, setDraft] = useState("")
  const [remember, setRemember] = useState(true)

  const save = async () => {
    await actions.saveKey(draft, remember)
    setDraft("")
  }

  if (keyStored) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" />Key saved</span>
        <Button size="sm" variant="outline" onClick={actions.removeKey}>Remove key</Button>
      </div>
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex gap-2">
        <Input
          type="password"
          autoComplete="off"
          value={draft}
          placeholder={provider.keyRequired ? "Paste API key" : "Optional"}
          aria-label="API key"
          onChange={(event) => setDraft(event.target.value)}
          className="font-mono"
        />
        <Button size="sm" disabled={!draft.trim()} onClick={save}>Save key</Button>
      </div>
      {actions.holdsKeyOnDevice && (
        <Checkbox checked={remember} onChange={(event) => setRemember(event.target.checked)} className="justify-start">
          Remember on this device (otherwise only until the tab closes)
        </Checkbox>
      )}
    </div>
  )
}

function ConnectionTest({ test, onRun, disabled }) {
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" disabled={disabled || test.status === "running"} onClick={onRun}>
        Test connection
      </Button>
      {test.status === "running" && <Skeleton className="h-3 w-24" />}
      {test.message && (
        <span role="status" className={`min-w-0 text-xs ${test.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>{test.message}</span>
      )}
    </div>
  )
}

export function AiSettingsDialog({ actions }) {
  const settings = useAiStore((s) => s.settings)
  const keyStored = useAiStore((s) => s.keyStored)
  const test = useAiStore((s) => s.test)
  const provider = providerById(settings.provider)
  const needsKey = provider.keyRequired && !keyStored
  const wantsInsecure = settings.baseUrl.trim().toLowerCase().startsWith("http://")
  const canEnable = settings.consented

  return (
    <Dialog label="AI settings" onClose={actions.closeSettings}>
      <DialogHeader onClose={actions.closeSettings}><DialogTitle>AI</DialogTitle></DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{OFF_NOTE}</p>
        <Checkbox
          checked={settings.consented}
          onChange={(event) => actions.saveSettings({ consented: event.target.checked, enabled: event.target.checked && settings.enabled })}
          className="h-auto items-start justify-start"
        >
          I understand that when I run an AI action, the previewed request or response details are sent to {hostOf(settings)}, and billing is between me and the provider.
        </Checkbox>
        <Checkbox
          checked={settings.enabled}
          disabled={!canEnable}
          onChange={(event) => actions.saveSettings({ enabled: event.target.checked })}
          className="justify-start"
        >
          Turn on AI features
        </Checkbox>
        <Field label="Provider">
          <Select value={settings.provider} onChange={(event) => actions.selectProvider(event.target.value)} aria-label="Provider">
            {PROVIDERS.map((option) => <option key={option.id} value={option.id} icon={<BrandIcon brand={option.id} />}>{option.label}</option>)}
          </Select>
        </Field>
        <Field label="Base URL">
          <Input
            value={settings.baseUrl}
            placeholder={provider.baseUrl || "https://host/v1"}
            aria-label="Base URL"
            spellCheck={false}
            onChange={(event) => actions.saveSettings({ baseUrl: event.target.value })}
            className="font-mono"
          />
        </Field>
        {wantsInsecure && (
          <Checkbox
            checked={settings.allowInsecure}
            onChange={(event) => actions.saveSettings({ allowInsecure: event.target.checked })}
            className="justify-start"
          >
            Allow plain http to this address (loopback addresses are always allowed)
          </Checkbox>
        )}
        <Field label="Model id">
          <Input
            value={settings.model}
            placeholder={`for example ${provider.modelHint}`}
            aria-label="Model id"
            spellCheck={false}
            onChange={(event) => actions.saveSettings({ model: event.target.value })}
            className="font-mono"
          />
        </Field>
        <Field label="API key" grouped>
          <KeyField key={settings.provider} actions={actions} keyStored={keyStored} provider={provider} />
        </Field>
        <ConnectionTest test={test} onRun={actions.testConnection} disabled={needsKey || !settings.model.trim()} />
        <p className="text-xs text-muted-foreground">{actions.holdsKeyOnDevice ? BROWSER_NOTE : DESKTOP_NOTE}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={actions.forgetEverything}>Disable AI and forget keys</Button>
        <Button onClick={actions.closeSettings}>Done</Button>
      </DialogFooter>
    </Dialog>
  )
}
