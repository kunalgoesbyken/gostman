import { useState } from "react"
import { FolderOpen, X } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Input } from "./ui/input"
import { SectionLabel } from "./ui/panel"
import { specSourceOf } from "../lib/mockServer"
import { MOCK_TEXT } from "../lib/mockText"
import { SPEC_TEXT } from "../lib/specText"

export function MockSpecImport({ spec, isLoading, onImport, onClear, onPickFile }) {
  const [address, setAddress] = useState("")

  const submit = (event) => {
    event.preventDefault()
    onImport(specSourceOf(address))
  }

  const pick = async () => {
    const path = await onPickFile(SPEC_TEXT.chooseSpecFile)
    if (path) onImport(specSourceOf(path))
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border px-3 py-2">
      <form className="flex items-center gap-2" onSubmit={submit}>
        <SectionLabel>{MOCK_TEXT.specTitle}</SectionLabel>
        <Input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder={SPEC_TEXT.addressPlaceholder}
          aria-label={SPEC_TEXT.addressLabel}
          className="font-mono"
        />
        <Button type="submit" variant="outline" size="sm" disabled={isLoading || address.trim() === ""}>{SPEC_TEXT.load}</Button>
        {onPickFile && (
          <Button variant="outline" size="sm" disabled={isLoading} onClick={pick}>
            <FolderOpen />
            {SPEC_TEXT.browse}
          </Button>
        )}
      </form>
      {spec.sources.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1 truncate" title={spec.title}>{MOCK_TEXT.specLoaded(spec.title, spec.sources.length)}</span>
          <IconButton label={MOCK_TEXT.specRemove} icon={X} size="icon-xs" onClick={onClear} />
        </div>
      )}
    </div>
  )
}
