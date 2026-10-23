import { useMemo } from "react"
import { AiButton } from "./AiButton"
import { MarkdownField } from "./MarkdownField"
import { Checkbox } from "./ui/checkbox"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { PanelBody } from "./ui/panel"
import { TagsInput } from "./ui/tagsInput"
import { SSE_SETTINGS_TEXT } from "../lib/sse"
import { collectTags } from "../lib/tags"
import { useAppStore } from "../store/appStore"

const DEFAULT_TIMEOUT_MS = 30000
const CHECKBOX_CLASS = "h-7 justify-start self-start"

const toWholeNumber = (text) => Math.max(0, Math.trunc(Number(text)) || 0)

export function SettingsPanel({ options, description, tags, onChange, onDescriptionChange, onTagsChange, onDocument }) {
  const update = (patch) => onChange({ ...options, ...patch })
  const requests = useAppStore((state) => state.requests)
  const knownTags = useMemo(() => collectTags(requests), [requests])

  return (
    <PanelBody className="h-full">
      <div className="flex max-w-xl flex-col gap-2">
        <Field label="Timeout (ms)">
          <Input
            type="number"
            min={0}
            step={1000}
            value={options.timeoutMs || ""}
            placeholder={`${DEFAULT_TIMEOUT_MS} (default)`}
            onChange={(event) => update({ timeoutMs: toWholeNumber(event.target.value) })}
            className="max-w-48 font-mono"
          />
        </Field>
        <Checkbox
          checked={!options.noFollowRedirects}
          onChange={(event) => update({ noFollowRedirects: !event.target.checked })}
          className={CHECKBOX_CLASS}
        >
          Follow redirects
        </Checkbox>
        <Checkbox
          checked={!options.insecureTLS}
          onChange={(event) => update({ insecureTLS: !event.target.checked })}
          className={CHECKBOX_CLASS}
        >
          Verify TLS certificates
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
        <Field label="Tags" grouped>
          <TagsInput
            value={tags}
            onChange={onTagsChange}
            label="Tags"
            placeholder="smoke, regression"
            suggestions={knownTags}
          />
        </Field>
        <Field label="Description" grouped>
          <MarkdownField
            value={description}
            onChange={onDescriptionChange}
            placeholder="What this request does (Markdown), shown in generated documentation"
            rows={4}
            label="Description"
            className="font-sans"
          />
        </Field>
        <AiButton label="Write the description with AI" onClick={onDocument} className="self-start">Write with AI</AiButton>
      </div>
    </PanelBody>
  )
}
