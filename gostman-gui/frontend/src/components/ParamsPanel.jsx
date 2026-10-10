import { useMemo } from "react"
import { KeyValueEditor } from "./KeyValueEditor"
import { readParamRows, writeParamRows } from "../lib/queryString"

export function ParamsPanel({ url, queryParams, onChange }) {
  const rows = useMemo(() => readParamRows(url, queryParams), [url, queryParams])

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <KeyValueEditor
          rows={rows}
          onChange={(next) => onChange(writeParamRows(url, next))}
          keyLabel="Parameter"
        />
      </div>
      <p className="border-t border-border/50 px-4 py-2 text-xs text-muted-foreground">
        These rows mirror the query string in the URL. Unchecked rows are kept here but not sent.
      </p>
    </div>
  )
}
