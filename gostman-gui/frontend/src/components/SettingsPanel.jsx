import { useMemo } from "react"
import { AiButton } from "./AiButton"
import { AI_TEXT } from "../lib/aiText"
import { MarkdownField } from "./MarkdownField"
import { Checkbox } from "./ui/checkbox"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { PanelBody } from "./ui/panel"
import { TagsInput } from "./ui/tagsInput"
import { SSE_SETTINGS_TEXT } from "../lib/sse"
import { BUILT_IN_TIMEOUT_SECONDS, usePreferences } from "../lib/preferences"
import { REQUEST_SETTINGS_TEXT as TEXT } from "../lib/requestSettingsText"
import { SETTING_REDIRECTS, SETTING_SEND_COOKIES, SETTING_STORE_COOKIES, SETTING_STREAM, SETTING_TIMEOUT, SETTING_TLS } from "../lib/requestSections"
import { collectTags } from "../lib/tags"
import { useAppStore } from "../store/appStore"

const defaultTimeoutMs = ({ requestTimeoutSeconds }) => (requestTimeoutSeconds || BUILT_IN_TIMEOUT_SECONDS) * 1000
const CHECKBOX_CLASS = "h-7 justify-start self-start"

const SWITCHES = [
  { setting: SETTING_REDIRECTS, field: "noFollowRedirects", label: TEXT.followRedirects, inverted: true },
  { setting: SETTING_TLS, field: "insecureTLS", label: TEXT.verifyTls, inverted: true },
  { setting: SETTING_SEND_COOKIES, field: "skipCookies", label: TEXT.sendCookies, inverted: true },
  { setting: SETTING_STORE_COOKIES, field: "discardCookies", label: TEXT.storeCookies, inverted: true },
  { setting: SETTING_STREAM, field: "stream", label: SSE_SETTINGS_TEXT.stream, inverted: false },
]

const toWholeNumber = (text) => Math.max(0, Math.trunc(Number(text)) || 0)

export function SettingsPanel({ options, settings, description, tags, onChange, onDescriptionChange, onTagsChange, onDocument }) {
  const update = (patch) => onChange({ ...options, ...patch })
  const requests = useAppStore((state) => state.requests)
  const folders = useAppStore((state) => state.folders)
  const preferences = usePreferences()
  const knownTags = useMemo(() => collectTags([...requests, ...folders]), [requests, folders])

  return (
    <PanelBody className="h-full">
      <div className="flex max-w-xl flex-col gap-2">
        {settings.has(SETTING_TIMEOUT) && (
          <Field label={TEXT.timeout}>
            <Input
              type="number"
              min={0}
              step={1000}
              value={options.timeoutMs || ""}
              placeholder={TEXT.timeoutPlaceholder(defaultTimeoutMs(preferences))}
              onChange={(event) => update({ timeoutMs: toWholeNumber(event.target.value) })}
              className="max-w-48 font-mono"
            />
          </Field>
        )}
        {SWITCHES.filter(({ setting }) => settings.has(setting)).map(({ setting, field, label, inverted }) => (
          <Checkbox
            key={setting}
            checked={inverted ? !options[field] : Boolean(options[field])}
            onChange={(event) => update({ [field]: inverted ? !event.target.checked : event.target.checked })}
            className={CHECKBOX_CLASS}
          >
            {label}
          </Checkbox>
        ))}
        {options.stream && (
          <>
            <Checkbox
              checked={options.streamReconnect}
              onChange={(event) => update({ streamReconnect: event.target.checked })}
              className={CHECKBOX_CLASS}
            >
              {SSE_SETTINGS_TEXT.reconnect}
            </Checkbox>
            <Field label={SSE_SETTINGS_TEXT.maxEvents}>
              <Input
                type="number"
                min={0}
                value={options.streamMaxEvents || ""}
                placeholder={SSE_SETTINGS_TEXT.maxEventsPlaceholder}
                onChange={(event) => update({ streamMaxEvents: toWholeNumber(event.target.value) })}
                className="max-w-48 font-mono"
              />
            </Field>
            <Field label={SSE_SETTINGS_TEXT.maxSeconds}>
              <Input
                type="number"
                min={0}
                value={options.streamMaxSeconds || ""}
                placeholder={SSE_SETTINGS_TEXT.maxSecondsPlaceholder}
                onChange={(event) => update({ streamMaxSeconds: toWholeNumber(event.target.value) })}
                className="max-w-48 font-mono"
              />
            </Field>
          </>
        )}
        <Field label={TEXT.tags} grouped>
          <TagsInput
            value={tags}
            onChange={onTagsChange}
            label={TEXT.tags}
            placeholder={TEXT.tagsPlaceholder}
            suggestions={knownTags}
          />
        </Field>
        <Field label={TEXT.description} grouped>
          <MarkdownField
            value={description}
            onChange={onDescriptionChange}
            placeholder={TEXT.descriptionPlaceholder}
            rows={4}
            label={TEXT.description}
            className="font-sans"
          />
        </Field>
        {onDocument && <AiButton label={AI_TEXT.buttons.documentLabel} onClick={onDocument} className="self-start">{AI_TEXT.buttons.document}</AiButton>}
      </div>
    </PanelBody>
  )
}
