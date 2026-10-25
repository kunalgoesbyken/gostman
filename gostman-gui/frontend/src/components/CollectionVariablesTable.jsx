import { useState } from "react"
import { EnvironmentTable } from "./EnvironmentTable"
import { environmentEntries, withEntries } from "../lib/variableScopes"
import { useAppStore } from "../store/appStore"

const FEATURES = { enabled: false, secret: true, readOnly: false }

const listOf = (holder, state) => (holder
  ? { variables: holder.collectionVariables, meta: holder.collectionVariablesMeta }
  : { variables: state.collectionVariables, meta: state.collectionVariablesMeta })

export function CollectionVariablesTable({ holder, query = "" }) {
  const setCollectionVariables = useAppStore((s) => s.setCollectionVariables)
  const patchFolders = useAppStore((s) => s.patchFolders)
  const [rows, setRows] = useState(() => environmentEntries(listOf(holder, useAppStore.getState())))

  const editRows = (next) => {
    setRows(next)
    const { variables, meta } = withEntries({}, next)
    if (holder) patchFolders([{ id: holder.id, collectionVariables: variables, collectionVariablesMeta: meta }])
    else setCollectionVariables(variables, meta)
  }

  return <EnvironmentTable rows={rows} query={query} features={FEATURES} onChange={editRows} />
}
