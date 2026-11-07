import { useMemo } from "react"
import { Braces } from "lucide-react"
import { Notice } from "./ui/panel"
import { selectActiveTab, useAppStore } from "../store/appStore"
import { parseRows } from "../lib/rows"
import { VARS_PANEL } from "../lib/requestSections"
import { UNRESOLVED_TEXT } from "../lib/unresolvedText"
import { parseExtractors } from "../lib/chaining"

const LINK_BUTTON = "font-medium text-primary underline-offset-2 hover:underline"
const NAME_BUTTON = "me-1.5 rounded-sm font-mono text-foreground underline-offset-2 hover:underline"

const describe = (isFailed, count) => (isFailed ? UNRESOLVED_TEXT.notDefined(count) : UNRESOLVED_TEXT.sentAsWritten(count))

export const hasUnresolved = (names) => Array.isArray(names) && names.length > 0

export function UnresolvedNames({ names, isFailed }) {
  const defineVariable = useAppStore((state) => state.defineVariable)
  return (
    <>
      {describe(isFailed, names.length)}{' '}
      {names.map((name) => (
        <button key={name} type="button" title={UNRESOLVED_TEXT.define(name)} className={NAME_BUTTON} onClick={() => defineVariable(name)}>
          {UNRESOLVED_TEXT.placeholder(name)}
        </button>
      ))}
    </>
  )
}

const extracts = (request, name) => parseExtractors(request.extractors).some((rule) => rule.enabled && rule.name === name)

function findSource(requests, names) {
  for (const name of names) {
    const request = requests.find((candidate) => extracts(candidate, name))
    if (request) return { name, request }
  }
  return null
}

function SourceHint({ source, isOnly }) {
  const openRequestTab = useAppStore((state) => state.openRequestTab)
  return (
    <>
      {' '}{UNRESOLVED_TEXT.extractedBy(source.name, source.request.name, isOnly)}{' '}
      <button type="button" className={LINK_BUTTON} onClick={() => openRequestTab(source.request)}>{UNRESOLVED_TEXT.openSource(source.request.name)}</button>
    </>
  )
}

const switchedOffName = (vars, names) => {
  const off = parseRows(vars).filter((row) => !row.enabled).map((row) => row.key.trim())
  return names.find((name) => off.includes(name)) ?? ""
}

function SwitchedOffHint({ name, tabId }) {
  const openEditorPanel = useAppStore((state) => state.openEditorPanel)
  return (
    <>
      {' '}{UNRESOLVED_TEXT.switchedOff(name)}{' '}
      <button type="button" className={LINK_BUTTON} onClick={() => openEditorPanel(tabId, VARS_PANEL)}>{UNRESOLVED_TEXT.openVars}</button>
    </>
  )
}

export function UnresolvedNotice({ response }) {
  const defineVariable = useAppStore((state) => state.defineVariable)
  const requests = useAppStore((state) => state.requests)
  const tabId = useAppStore((state) => state.activeTabId)
  const vars = useAppStore((state) => selectActiveTab(state)?.request?.vars)
  const names = response?.unresolved
  const source = useMemo(() => (hasUnresolved(names) ? findSource(requests, names) : null), [requests, names])
  const offName = useMemo(() => (hasUnresolved(names) ? switchedOffName(vars, names) : ""), [vars, names])
  if (!hasUnresolved(names)) return null
  return (
    <Notice tone="warning" icon={Braces} role="status">
      <UnresolvedNames names={names} isFailed={Boolean(response.error)} />
      {offName ? <SwitchedOffHint name={offName} tabId={tabId} /> : source ? <SourceHint source={source} isOnly={names.length === 1} /> : (
        <button type="button" className={LINK_BUTTON} onClick={() => defineVariable(names[0])}>{UNRESOLVED_TEXT.openEnvironments}</button>
      )}
    </Notice>
  )
}
