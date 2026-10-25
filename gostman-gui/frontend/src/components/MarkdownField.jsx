import { useState } from "react"
import { MarkdownView } from "./MarkdownView"
import { SegmentedControl } from "./ui/segmented"
import { Textarea } from "./ui/textarea"
import { MARKDOWN_TEXT } from "../lib/markdownText"

const MODE_EDIT = "edit"
const MODE_PREVIEW = "preview"
const MODES = [
  { value: MODE_EDIT, get label() { return MARKDOWN_TEXT.edit } },
  { value: MODE_PREVIEW, get label() { return MARKDOWN_TEXT.preview } },
]

export function MarkdownField({ value, onChange, placeholder, rows, label, className }) {
  const [mode, setMode] = useState(MODE_EDIT)

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SegmentedControl label={MARKDOWN_TEXT.modeLabel} options={MODES} value={mode} onChange={setMode} className="self-start" />
      {mode === MODE_EDIT ? (
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          aria-label={label}
          dir="auto"
          className={className}
        />
      ) : (
        <div className="min-h-16 rounded-md border border-border p-2">
          <MarkdownView source={value} />
        </div>
      )}
    </div>
  )
}
