import { useRef, useState } from "react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Input } from "./ui/input"
import { EXPORT_TEXT } from "../lib/importText"

export const DEFAULT_DOCS_OPTIONS = { title: "", includeExamples: true, playground: false, accent: "", logo: "" }

const LOGO_LIMIT_BYTES = 300 * 1024

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

export function DocsOptions({ options, onChange }) {
  const update = (patch) => onChange({ ...options, ...patch })
  const picker = useRef(null)
  const [logoProblem, setLogoProblem] = useState("")

  const chooseLogo = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (file.size > LOGO_LIMIT_BYTES) return setLogoProblem(EXPORT_TEXT.docs.logoTooLarge)
    setLogoProblem("")
    update({ logo: await readAsDataUrl(file) })
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3">
      <Input
        value={options.title}
        onChange={(event) => update({ title: event.target.value })}
        placeholder={EXPORT_TEXT.docs.titlePlaceholder}
        aria-label={EXPORT_TEXT.docs.titleLabel}
        className="min-w-48 flex-1"
      />
      <Input
        value={options.accent}
        onChange={(event) => update({ accent: event.target.value })}
        placeholder={EXPORT_TEXT.docs.accentPlaceholder}
        aria-label={EXPORT_TEXT.docs.accentLabel}
        className="w-48"
      />
      <input ref={picker} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" className="hidden" onChange={chooseLogo} />
      <Button size="sm" variant="outline" onClick={() => (options.logo ? update({ logo: "" }) : picker.current.click())}>
        {options.logo ? EXPORT_TEXT.docs.logoRemove : EXPORT_TEXT.docs.logoChoose}
      </Button>
      {logoProblem && <span role="alert" className="text-xs text-destructive">{logoProblem}</span>}
      <Checkbox checked={options.includeExamples} onChange={(event) => update({ includeExamples: event.target.checked })}>
        {EXPORT_TEXT.docs.includeExamples}
      </Checkbox>
      <Checkbox checked={options.playground} onChange={(event) => update({ playground: event.target.checked })}>
        {EXPORT_TEXT.docs.playground}
      </Checkbox>
    </div>
  )
}
