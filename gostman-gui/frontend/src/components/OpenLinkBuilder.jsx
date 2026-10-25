import { useMemo, useState } from "react"
import { CopyTextButton } from "./CopyTextButton"
import { DisclosureSummary } from "./ui/disclosure"
import { Input } from "./ui/input"
import { OPEN_LINK_TEXT } from "../lib/openLinkText"
import { buildOpenLinks } from "../lib/openSource"

function buildFor(address, linkBase) {
  if (address.trim() === "") return { links: null, error: "" }
  try {
    return { links: buildOpenLinks(address.trim(), linkBase), error: "" }
  } catch (error) {
    return { links: null, error: error.message }
  }
}

function OutputRow({ label, value }) {
  return (
    <div className="flex items-center gap-2">
      <Input readOnly value={value} aria-label={label} className="font-mono" onFocus={(event) => event.target.select()} />
      <CopyTextButton text={value} />
    </div>
  )
}

export function OpenLinkBuilder({ linkBase }) {
  const [address, setAddress] = useState("")
  const { links, error } = useMemo(() => buildFor(address, linkBase), [address, linkBase])

  return (
    <details className="group shrink-0 rounded-md border border-border">
      <DisclosureSummary className="px-3 py-2 text-xs font-medium text-foreground">{OPEN_LINK_TEXT.builderTitle}</DisclosureSummary>
      <div className="flex max-h-56 flex-col gap-2 overflow-y-auto border-t border-border p-3">
        <p className="text-xs text-muted-foreground">{OPEN_LINK_TEXT.builderHint}</p>
        <Input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder={OPEN_LINK_TEXT.builderPlaceholder}
          aria-label={OPEN_LINK_TEXT.builderLabel}
          spellCheck={false}
          className="font-mono"
        />
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        {links && (
          <>
            <OutputRow label={OPEN_LINK_TEXT.webLabel} value={links.web} />
            <OutputRow label={OPEN_LINK_TEXT.badgeLabel} value={links.badge} />
            <OutputRow label={OPEN_LINK_TEXT.desktopLabel} value={links.desktop} />
          </>
        )}
      </div>
    </details>
  )
}
