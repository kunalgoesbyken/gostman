import { useMemo } from "react"
import { Notice, Panel } from "./ui/panel"
import { KeyValueEditor } from "./KeyValueEditor"
import { readParamRows, writeParamRows } from "../lib/queryString"
import { REQUEST_TABS_TEXT } from "../lib/requestTabsText"

export function ParamsPanel({ url, queryParams, onChange }) {
  const rows = useMemo(() => readParamRows(url, queryParams), [url, queryParams])

  return (
    <Panel>
      <KeyValueEditor rows={rows} onChange={(next) => onChange(writeParamRows(url, next))} keyLabel={REQUEST_TABS_TEXT.paramLabel} />
      <Notice edge="border-t">{REQUEST_TABS_TEXT.paramsNote}</Notice>
    </Panel>
  )
}
