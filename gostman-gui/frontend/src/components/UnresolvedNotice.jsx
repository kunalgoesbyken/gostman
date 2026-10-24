import { Braces } from "lucide-react"
import { Notice } from "./ui/panel"
import { useAppStore } from "../store/appStore"
import { UNRESOLVED_TEXT } from "../lib/unresolvedText"

const LINK_BUTTON = "font-medium text-primary underline-offset-2 hover:underline"

const describe = (response, count) => (response.error ? UNRESOLVED_TEXT.notDefined(count) : UNRESOLVED_TEXT.sentAsWritten(count))

export function UnresolvedNotice({ response }) {
  const openEnvironments = useAppStore((state) => state.openEnvironmentDialog)
  const names = response?.unresolved
  if (!Array.isArray(names) || names.length === 0) return null
  return (
    <Notice tone="warning" icon={Braces} role="status">
      {describe(response, names.length)}{' '}
      {names.map((name) => (
        <code key={name} className="mr-1.5 font-mono text-foreground">{UNRESOLVED_TEXT.placeholder(name)}</code>
      ))}
      <button type="button" className={LINK_BUTTON} onClick={openEnvironments}>{UNRESOLVED_TEXT.openEnvironments}</button>
    </Notice>
  )
}
