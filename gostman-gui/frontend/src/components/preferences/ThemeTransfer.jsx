import { useId, useState } from "react"
import { Copy, Import } from "lucide-react"
import { PreferenceGroup } from "./PreferenceRows"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"
import { updatePreferences } from "../../lib/preferences"
import { PREFERENCES_TEXT } from "../../lib/preferencesText"
import { parseTheme, serializeTheme } from "../../lib/themes"
import { cn } from "../../lib/utils"

const TEXT = PREFERENCES_TEXT.theme

function ImportForm({ onDone, onCancel }) {
  const [text, setText] = useState("")
  const [isInvalid, setIsInvalid] = useState(false)
  const errorId = useId()

  const apply = (event) => {
    event.preventDefault()
    const theme = parseTheme(text)
    if (!theme) {
      setIsInvalid(true)
      return
    }
    updatePreferences(theme)
    onDone()
  }

  const change = (event) => {
    setText(event.target.value)
    setIsInvalid(false)
  }

  return (
    <form onSubmit={apply} className="space-y-2">
      <Textarea
        aria-label={TEXT.importLabel}
        aria-invalid={isInvalid}
        aria-describedby={isInvalid ? errorId : undefined}
        placeholder={TEXT.importPlaceholder}
        value={text}
        onChange={change}
        rows={6}
        autoFocus
        className="text-2xs"
      />
      {isInvalid && <p id={errorId} role="alert" className="text-2xs text-destructive">{TEXT.invalid}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>{TEXT.cancel}</Button>
        <Button type="submit" size="sm" disabled={text.trim() === ""}>{TEXT.apply}</Button>
      </div>
    </form>
  )
}

export function ThemeTransfer({ preferences }) {
  const [isImporting, setIsImporting] = useState(false)
  const [status, setStatus] = useState({ text: "", failed: false })

  const copy = () =>
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(serializeTheme(preferences)))
      .then(() => setStatus({ text: TEXT.copied, failed: false }))
      .catch(() => setStatus({ text: TEXT.copyFailed, failed: true }))

  const startImport = () => {
    setStatus({ text: "", failed: false })
    setIsImporting(true)
  }

  const finishImport = () => {
    setIsImporting(false)
    setStatus({ text: TEXT.imported, failed: false })
  }

  return (
    <PreferenceGroup title={TEXT.share} hint={TEXT.shareHint}>
      {isImporting ? (
        <ImportForm onDone={finishImport} onCancel={() => setIsImporting(false)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copy}>
            <Copy />
            {TEXT.copy}
          </Button>
          <Button variant="outline" size="sm" onClick={startImport}>
            <Import />
            {TEXT.import}
          </Button>
        </div>
      )}
      {status.text && <p role="status" className={cn("text-2xs", status.failed ? "text-destructive" : "text-muted-foreground")}>{status.text}</p>}
    </PreferenceGroup>
  )
}
