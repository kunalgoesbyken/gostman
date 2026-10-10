import { useMemo } from "react"
import { Notice, Panel } from "./ui/panel"
import { KeyValueEditor } from "./KeyValueEditor"
import { readParamRows, writeParamRows } from "../lib/queryString"

export function ParamsPanel({ url, queryParams, onChange }) {
  const rows = useMemo(() => readParamRows(url, queryParams), [url, queryParams])

  return (
    <Panel>
      <KeyValueEditor rows={rows} onChange={(next) => onChange(writeParamRows(url, next))} keyLabel="Parameter" />
      <Notice edge="border-t">
        These rows mirror the query string in the URL. Unchecked rows are kept here but not sent.
      </Notice>
    </Panel>
  )
}
