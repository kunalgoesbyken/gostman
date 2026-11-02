import { useState } from "react"
import { EnvironmentTable } from "./EnvironmentTable"
import { Notice, Toolbar } from "./ui/panel"
import { InfoTip } from "./ui/infoTip"
import { SegmentedControl } from "./ui/segmented"
import { Textarea } from "./ui/textarea"
import { ENVIRONMENT_TEXT as TEXT } from "../lib/environmentText"
import { heldRows, linesOf, rowsFromLines } from "../lib/variableLines"
import { environmentEntries, withEntries } from "../lib/variableScopes"
import { VIEW_TABLE, VIEW_TEXT, rememberVariablesView, rememberedVariablesView } from "../lib/variablesView"
import { useAppStore } from "../store/appStore"

const FEATURES = { enabled: false, secret: true, readOnly: false }
const VIEWS = [
  { value: VIEW_TABLE, get label() { return TEXT.viewTable } },
  { value: VIEW_TEXT, get label() { return TEXT.viewText } },
]

const listOf = (holder, state) => (holder
  ? { variables: holder.collectionVariables, meta: holder.collectionVariablesMeta }
  : { variables: state.collectionVariables, meta: state.collectionVariablesMeta })

export function CollectionVariablesTable({ holder, query = "", note }) {
  const setCollectionVariables = useAppStore((s) => s.setCollectionVariables)
  const patchFolders = useAppStore((s) => s.patchFolders)
  const [rows, setRows] = useState(() => environmentEntries(listOf(holder, useAppStore.getState())))
  const [view, setView] = useState(rememberedVariablesView)
  const [text, setText] = useState(() => linesOf(rows))

  const editRows = (next) => {
    setRows(next)
    const { variables, meta } = withEntries({}, next)
    if (holder) patchFolders([{ id: holder.id, collectionVariables: variables, collectionVariablesMeta: meta }])
    else setCollectionVariables(variables, meta)
  }

  const chooseView = (next) => {
    if (next === VIEW_TEXT) setText(linesOf(rows))
    setView(next)
    rememberVariablesView(next)
  }

  const editText = (next) => {
    setText(next)
    editRows(rowsFromLines(next, rows))
  }

  const held = heldRows(rows).length
  const tip = [note, view === VIEW_TEXT && TEXT.textNote].filter(Boolean).join(" ")

  return (
    <>
      <Toolbar>
        <SegmentedControl label={TEXT.viewLabel} options={VIEWS} value={view} onChange={chooseView} />
        {tip && <InfoTip text={tip} />}
      </Toolbar>
      {view === VIEW_TEXT ? (
        <>
          <Textarea
            value={text}
            aria-label={TEXT.textLabel}
            placeholder={TEXT.textPlaceholder}
            dir="ltr"
            autoComplete="off"
            onChange={(event) => editText(event.target.value)}
            className="min-h-0 flex-1 rounded-none border-0 px-3"
          />
          {held > 0 && <Notice edge="border-t">{TEXT.heldRows(held)}</Notice>}
        </>
      ) : (
        <EnvironmentTable rows={rows} query={query} features={FEATURES} onChange={editRows} />
      )}
    </>
  )
}
