import { useRef, useState } from "react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { Select } from "./ui/select"
import { PanelBody } from "./ui/panel"
import { ROOT_ID, buildCollectionTree, listFolders } from "../lib/collectionTree"
import { KIND_FLOW, KIND_FOLDER } from "../lib/monitors/monitorRecord"
import { INTERVALS, MAX_INTERVAL_MINUTES, MIN_INTERVAL_MINUTES } from "../lib/monitors/monitorSession"
import { MONITORS_TEXT as TEXT } from "../lib/monitorsText"
import { DATA_ACCEPT, DATA_FILE_ERROR, readDataFile } from "../lib/runData"
import { useAppStore } from "../store/appStore"

const CUSTOM = "custom"
const PATH_SEPARATOR = " / "
const WEB_PROTOCOLS = new Set(["http:", "https:"])

const targetValue = (draft) => `${draft.kind}:${draft.targetId}`

function targetOptions(folders, flows) {
  const scopes = listFolders(buildCollectionTree(folders, []))
  return [
    { value: `${KIND_FOLDER}:${ROOT_ID}`, label: TEXT.form.allRequests },
    ...scopes.map(({ folder, path }) => ({ value: `${KIND_FOLDER}:${folder.id}`, label: TEXT.form.targetFolder(path.join(PATH_SEPARATOR)) })),
    ...flows.map((flow) => ({ value: `${KIND_FLOW}:${flow.id}`, label: TEXT.form.targetFlow(flow.name) })),
  ]
}

const isWebAddress = (text) => URL.canParse(text) && WEB_PROTOCOLS.has(new URL(text).protocol)

const isKnownInterval = (minutes) => minutes >= MIN_INTERVAL_MINUTES && minutes <= MAX_INTERVAL_MINUTES

function validate(draft, webhook) {
  if (!draft.name.trim()) return TEXT.form.nameRequired
  if (draft.kind === KIND_FLOW && draft.targetId === "") return TEXT.form.targetRequired
  if (!isKnownInterval(draft.intervalMinutes)) return TEXT.form.intervalInvalid
  if (webhook.trim() && !isWebAddress(webhook.trim())) return TEXT.form.webhookInvalid
  return ""
}

export function MonitorForm({ draft: initial, hasWebhooks, onSave, onCancel }) {
  const folders = useAppStore((s) => s.folders)
  const flows = useAppStore((s) => s.flows)
  const environments = useAppStore((s) => s.environments)
  const [draft, setDraft] = useState(initial)
  const [webhook, setWebhook] = useState("")
  const [rows, setRows] = useState(undefined)
  const [error, setError] = useState("")
  const [isCustom, setIsCustom] = useState(!INTERVALS.some(({ minutes }) => minutes === initial.intervalMinutes))
  const fileInput = useRef(null)
  const change = (changes) => setDraft((current) => ({ ...current, ...changes }))
  const canNotifyInBrowser = typeof Notification !== "undefined"

  const chooseTarget = (value) => {
    const [kind, ...rest] = value.split(":")
    change({ kind, targetId: rest.join(":") })
  }

  async function chooseData(event) {
    const [file] = event.target.files
    event.target.value = ""
    if (!file) return
    try {
      setRows(await readDataFile(file))
      change({ dataName: file.name })
      setError("")
    } catch (failure) {
      setError(failure instanceof SyntaxError ? DATA_FILE_ERROR.unreadable : failure.message)
    }
  }

  async function toggleBrowserNotify(checked) {
    if (checked && Notification.permission === "default") await Notification.requestPermission()
    if (checked && Notification.permission === "denied") {
      setError(TEXT.form.browserBlocked)
      return
    }
    setError("")
    change({ browserNotify: checked })
  }

  async function submit(event) {
    event.preventDefault()
    const problem = validate(draft, webhook)
    setError(problem)
    if (!problem) {
      try {
        await onSave(draft, webhook, rows)
      } catch (failure) {
        setError(failure?.message || TEXT.saveFailed)
      }
    }
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <PanelBody className="flex flex-col gap-3">
        <Field label={TEXT.form.name}>
          <Input value={draft.name} placeholder={TEXT.form.namePlaceholder} onChange={(event) => change({ name: event.target.value })} />
        </Field>
        <Field label={TEXT.form.target}>
          <Select value={targetValue(draft)} onChange={(event) => chooseTarget(event.target.value)} aria-label={TEXT.form.target}>
            {targetOptions(folders, flows).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </Field>
        <Field label={TEXT.form.environment}>
          <Select value={draft.environmentId} onChange={(event) => change({ environmentId: event.target.value })} aria-label={TEXT.form.environment}>
            <option value="">{TEXT.form.currentEnvironment}</option>
            {environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
          </Select>
        </Field>
        <Field label={TEXT.form.interval}>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="w-40">
              <Select
                value={isCustom ? CUSTOM : String(draft.intervalMinutes)}
                aria-label={TEXT.form.interval}
                onChange={(event) => {
                  const custom = event.target.value === CUSTOM
                  setIsCustom(custom)
                  if (!custom) change({ intervalMinutes: Number(event.target.value) })
                }}
              >
                {INTERVALS.map(({ minutes, key }) => <option key={key} value={String(minutes)}>{TEXT.intervals[key]}</option>)}
                <option value={CUSTOM}>{TEXT.form.custom}</option>
              </Select>
            </div>
            {isCustom && (
              <Input
                type="number"
                min={MIN_INTERVAL_MINUTES}
                max={MAX_INTERVAL_MINUTES}
                className="w-28 font-mono"
                aria-label={TEXT.form.customMinutes}
                placeholder={TEXT.form.customMinutes}
                value={draft.intervalMinutes || ""}
                onChange={(event) => change({ intervalMinutes: Math.trunc(Number(event.target.value)) })}
              />
            )}
          </div>
        </Field>
        {draft.kind === KIND_FOLDER && (
          <Field label={TEXT.form.dataFile} grouped>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <input ref={fileInput} type="file" accept={DATA_ACCEPT} hidden onChange={chooseData} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current.click()}>{TEXT.form.chooseData}</Button>
              {draft.dataName && (
                <>
                  <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{draft.dataName}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setRows(null); change({ dataName: "" }) }}>{TEXT.form.clearData}</Button>
                </>
              )}
              <p className="basis-full text-2xs text-muted-foreground">{TEXT.form.dataHint}</p>
            </div>
          </Field>
        )}
        <Field label={TEXT.form.notifications} grouped>
          <div className="flex min-w-0 flex-col gap-2">
            <Checkbox className="justify-start" checked={draft.notify} onChange={(event) => change({ notify: event.target.checked })}>{TEXT.form.notify}</Checkbox>
            {draft.notify && canNotifyInBrowser && (
              <Checkbox className="justify-start" checked={draft.browserNotify} onChange={(event) => toggleBrowserNotify(event.target.checked)}>{TEXT.form.browserNotify}</Checkbox>
            )}
            {draft.notify && hasWebhooks && (
              <div className="flex flex-col gap-1">
                <Input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={TEXT.form.webhook}
                  placeholder={draft.hasWebhook ? TEXT.form.webhookSaved : TEXT.form.webhookPlaceholder}
                  value={webhook}
                  onChange={(event) => setWebhook(event.target.value)}
                />
                <p className="text-2xs text-muted-foreground">{TEXT.form.webhookHint}</p>
              </div>
            )}
          </div>
        </Field>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </PanelBody>
      <div className="flex shrink-0 justify-end gap-2 border-t border-border px-3 py-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{TEXT.form.cancel}</Button>
        <Button type="submit" size="sm">{TEXT.form.save}</Button>
      </div>
    </form>
  )
}
