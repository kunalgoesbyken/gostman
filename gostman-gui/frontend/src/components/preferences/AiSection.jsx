import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { BrandIcon } from "../ui/brandIcon"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Combobox } from "../ui/combobox"
import { Field } from "../ui/field"
import { Input } from "../ui/input"
import { Select } from "../ui/select"
import { Skeleton } from "../ui/skeleton"
import { AI_TEXT } from "../../lib/aiText"
import { PROVIDERS, hostOf, providerById } from "../../lib/ai/providers"
import { STATUS_ERROR, STATUS_OK, STATUS_RUNNING, useAiStore } from "../../lib/ai/session"
import { isAiEnabled, isConfigured } from "../../lib/ai/settings"

const TEXT = AI_TEXT.settings
const CHECKBOX_CLASS = "h-auto min-h-6 items-start justify-start py-0.5 text-left text-xs text-foreground"

function KeyField({ actions, keyStored, provider }) {
  const [draft, setDraft] = useState("")
  const [remember, setRemember] = useState(true)

  const save = async () => {
    await actions.saveKey(draft, remember)
    setDraft("")
  }

  if (keyStored) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" />{TEXT.keySaved}</span>
        <Button size="sm" variant="outline" onClick={actions.removeKey}>{TEXT.removeKey}</Button>
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
          placeholder={provider.keyRequired ? TEXT.pasteKey : TEXT.optionalKey}
          aria-label={TEXT.apiKey}
          onChange={(event) => setDraft(event.target.value)}
          className="min-w-0 font-mono"
        />
        <Button size="sm" disabled={!draft.trim()} onClick={save}>{TEXT.saveKey}</Button>
      </div>
      {actions.holdsKeyOnDevice && (
        <Checkbox checked={remember} onChange={(event) => setRemember(event.target.checked)} className={CHECKBOX_CLASS}>
          {TEXT.remember}
        </Checkbox>
      )}
    </div>
  )
}

function StatusLine({ status, message }) {
  if (status === STATUS_RUNNING) return <Skeleton className="h-3 w-24" />
  if (!message) return null
  return <span role="status" className={`min-w-0 text-2xs [overflow-wrap:anywhere] ${status === STATUS_ERROR ? "text-destructive" : "text-muted-foreground"}`}>{message}</span>
}

const modelsMessage = (models, provider) => {
  if (models.status !== STATUS_OK) return models.message
  if (models.list.length > 0) return TEXT.modelsFound(models.list.length)
  return provider.local ? TEXT.localNoModels : TEXT.noModels
}

function ModelField({ settings, models, provider, canList, actions }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex gap-2">
        <Combobox
          value={settings.model}
          suggestions={models.list}
          placeholder={provider.modelHint}
          aria-label={TEXT.model}
          spellCheck={false}
          onChange={(event) => actions.saveSettings({ model: event.target.value })}
          className="min-w-0 font-mono"
        />
        <Button size="sm" variant="outline" disabled={!canList || models.status === STATUS_RUNNING} onClick={actions.listModels}>
          {TEXT.listModels}
        </Button>
      </div>
      <StatusLine status={models.status} message={modelsMessage(models, provider)} />
    </div>
  )
}

function ConnectionTest({ test, onRun, disabled }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={disabled || test.status === STATUS_RUNNING} onClick={onRun}>
        {TEXT.test}
      </Button>
      <StatusLine status={test.status} message={test.message} />
    </div>
  )
}

function SkippedPreviews({ settings, onReset }) {
  const skipped = Object.values(settings.skipPreview).filter(Boolean).length
  if (skipped === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {TEXT.skipped(skipped)}
      <Button size="sm" variant="outline" onClick={onReset}>{TEXT.askAgain}</Button>
    </div>
  )
}

function ForgetButton({ settings, keyStored, onForget }) {
  if (!settings.consented && !keyStored) return null
  return (
    <Button size="sm" variant="outline" onClick={onForget}>
      {isAiEnabled(settings) ? TEXT.forget : TEXT.forgetWhileOff}
    </Button>
  )
}

const introOf = (settings, needsKey) => {
  if (!isAiEnabled(settings)) return TEXT.offNote
  return isConfigured(settings) && !needsKey ? TEXT.onNote : TEXT.needsSetup
}

export function AiSection({ actions }) {
  const settings = useAiStore((s) => s.settings)
  const keyStored = useAiStore((s) => s.keyStored)
  const test = useAiStore((s) => s.test)
  const models = useAiStore((s) => s.models)
  const provider = providerById(settings.provider)
  const needsKey = provider.keyRequired && !keyStored
  const wantsInsecure = settings.baseUrl.trim().toLowerCase().startsWith("http://")

  useEffect(() => {
    actions.prepareSettings()
    return actions.leaveSettings
  }, [actions])

  return (
    <>
      <p className="text-xs text-muted-foreground">{introOf(settings, needsKey)} {TEXT.previewNote}</p>
      <div className="space-y-1">
        <Checkbox
          checked={settings.consented}
          onChange={(event) => actions.saveSettings({ consented: event.target.checked, enabled: event.target.checked && settings.enabled })}
          className={CHECKBOX_CLASS}
        >
          {TEXT.consent(hostOf(settings))}
        </Checkbox>
        <Checkbox
          checked={settings.enabled}
          disabled={!settings.consented}
          onChange={(event) => actions.saveSettings({ enabled: event.target.checked })}
          className={CHECKBOX_CLASS}
        >
          {settings.consented ? TEXT.enable : TEXT.enableAfterConsent}
        </Checkbox>
      </div>
      <Field label={TEXT.provider}>
        <Select value={settings.provider} onChange={(event) => actions.selectProvider(event.target.value)} aria-label={TEXT.provider}>
          {PROVIDERS.map((option) => <option key={option.id} value={option.id} icon={<BrandIcon brand={option.id} />}>{option.label}</option>)}
        </Select>
      </Field>
      <Field label={TEXT.baseUrl}>
        <Input
          value={settings.baseUrl}
          placeholder={provider.baseUrl || TEXT.baseUrlPlaceholder}
          aria-label={TEXT.baseUrl}
          spellCheck={false}
          onChange={(event) => actions.saveSettings({ baseUrl: event.target.value })}
          className="font-mono"
        />
      </Field>
      {wantsInsecure && (
        <Checkbox
          checked={settings.allowInsecure}
          onChange={(event) => actions.saveSettings({ allowInsecure: event.target.checked })}
          className={CHECKBOX_CLASS}
        >
          {TEXT.allowInsecure}
        </Checkbox>
      )}
      <Field label={TEXT.apiKey} grouped>
        <KeyField key={settings.provider} actions={actions} keyStored={keyStored} provider={provider} />
      </Field>
      <Field label={TEXT.model} grouped>
        <ModelField settings={settings} models={models} provider={provider} canList={!needsKey} actions={actions} />
      </Field>
      <ConnectionTest test={test} onRun={actions.testConnection} disabled={needsKey || !settings.model.trim()} />
      <SkippedPreviews settings={settings} onReset={actions.askBeforeEveryAction} />
      <p className="text-2xs text-muted-foreground">{actions.holdsKeyOnDevice ? TEXT.browserNote : TEXT.desktopNote}</p>
      <ForgetButton settings={settings} keyStored={keyStored} onForget={actions.forgetEverything} />
    </>
  )
}
