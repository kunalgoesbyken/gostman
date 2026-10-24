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
import { BUILT_IN_TIMEOUT_SECONDS } from "../lib/preferences"
import { REQUEST_SETTINGS_TEXT as TEXT } from "../lib/requestSettingsText"
import { collectTags } from "../lib/tags"
import { useAppStore } from "../store/appStore"

const DEFAULT_TIMEOUT_MS = BUILT_IN_TIMEOUT_SECONDS * 1000
const CHECKBOX_CLASS = "h-7 justify-start self-start"

const toWholeNumber = (text) => Math.max(0, Math.trunc(Number(text)) || 0)

export function SettingsPanel({ options, description, tags, onChange, onDescriptionChange, onTagsChange, onDocument }) {
  const update = (patch) => onChange({ ...options, ...patch })
  const requests = useAppStore((state) => state.requests)
  const folders = useAppStore((state) => state.folders)
  const knownTags = useMemo(() => collectTags([...requests, ...folders]), [requests, folders])

  return (
    <PanelBody className="h-full">
      <div className="flex max-w-xl flex-col gap-2">
        <Field label={TEXT.timeout}>
          <Input
            type="number"
            min={0}
            step={1000}
            value={options.timeoutMs || ""}
            placeholder={TEXT.timeoutPlaceholder(DEFAULT_TIMEOUT_MS)}
            onChange={(event) => update({ timeoutMs: toWholeNumber(event.target.value) })}
            className="max-w-48 font-mono"
          />
        </Field>
        <Checkbox
          checked={!options.noFollowRedirects}
          onChange={(event) => update({ noFollowRedirects: !event.target.checked })}
          className={CHECKBOX_CLASS}
        >
          {TEXT.followRedirects}
        </Checkbox>
        <Checkbox
          checked={!options.insecureTLS}
          onChange={(event) => update({ insecureTLS: !event.target.checked })}
          className={CHECKBOX_CLASS}
        >
          {TEXT.verifyTls}
        </Checkbox>
        <Checkbox
          checked={!options.skipCookies}
          onChange={(event) => update({ skipCookies: !event.target.checked })}
          className={CHECKBOX_CLASS}
        >
          {TEXT.sendCookies}
        </Checkbox>
        <Checkbox
          checked={!options.discardCookies}
          onChange={(event) => update({ discardCookies: !event.target.checked })}
          className={CHECKBOX_CLASS}
        >
          {TEXT.storeCookies}
        </Checkbox>
        <Checkbox
          checked={options.stream}
          onChange={(event) => update({ stream: event.target.checked })}
          className={CHECKBOX_CLASS}
        >
          {SSE_SETTINGS_TEXT.stream}
        </Checkbox>
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
