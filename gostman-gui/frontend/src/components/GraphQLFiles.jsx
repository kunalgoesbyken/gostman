import { useMemo } from "react"
import { KeyValueEditor } from "./KeyValueEditor"
import { Notice, Panel } from "./ui/panel"
import { BODY_MULTIPART, BODY_NONE } from "../lib/body"
import { GRAPHQL_TEXT as TEXT } from "../lib/graphqlText"
import { isFileRow, parseRows, serializeRows } from "../lib/rows"

export const countGraphQLFiles = (body, bodyType) => (bodyType === BODY_MULTIPART ? parseRows(body).filter((row) => isFileRow(row) && row.enabled && row.key.trim() !== "").length : 0)

export function GraphQLFiles({ request, onUpdateRequest }) {
  const rows = useMemo(() => (request.bodyType === BODY_MULTIPART ? parseRows(request.body) : []), [request.body, request.bodyType])
  const change = (next) => onUpdateRequest(next.length === 0 ? { body: "", bodyType: BODY_NONE } : { body: serializeRows(next), bodyType: BODY_MULTIPART })

  return (
    <Panel>
      <Notice>{TEXT.filesNote}</Notice>
      <KeyValueEditor rows={rows} fileRows keyLabel={TEXT.filesVariable} valueLabel={TEXT.filesFile} onChange={change} />
    </Panel>
  )
}
