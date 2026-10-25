import { isPlainObject, parseJSON } from './dataUtils'
import { schemaMismatches } from './jsonSchema'
import { MCP_PROTOCOL } from './mcp'
import { MCP_OUTPUT_TEXT } from './mcpText'

export const MCP_OUTPUT_KIND = 'mcp-output'

const STRUCTURED_FIELD = 'structuredContent'

function problemsIn(schema, structured) {
  try {
    return schemaMismatches(schema, structured, undefined, false)
  } catch (error) {
    return [error.message]
  }
}

export function mcpOutputChecks(response) {
  if (response.protocol !== MCP_PROTOCOL || !response.outputSchema) return []
  const result = parseJSON(response.body, null)
  if (!isPlainObject(result) || !Object.hasOwn(result, STRUCTURED_FIELD)) return []
  const problems = problemsIn(response.outputSchema, result[STRUCTURED_FIELD])
  return [{ name: MCP_OUTPUT_TEXT.name, passed: problems.length === 0, message: problems.join('\n'), kind: MCP_OUTPUT_KIND }]
}
