import { isLocalCommand, trimAsciiSpace } from './mcp'
import { fillPlaceholders, parseVariableMap } from './placeholders'
import { isSentRow, parseRows } from './rows'
import { LOCAL_COMMAND_TEXT } from './localCommandsText'
import { PROMPT_PREFIX, isPromptName } from './variableNames'

export { LOCAL_COMMAND_TEXT }

const approved = new Set()

function describeCommand(request, variablesJSON) {
  const variables = parseVariableMap(variablesJSON) || new Map()
  const valueOf = (name) => variables.get(name) ?? (isPromptName(name) ? variables.get(name.slice(PROMPT_PREFIX.length).trim()) : undefined)
  const substitute = (text) => fillPlaceholders(text, valueOf)
  return {
    line: substitute(trimAsciiSpace(request.url)),
    environment: parseRows(request.headers).filter(isSentRow).map(({ key, value }) => `${substitute(key)}=${substitute(value)}`),
  }
}

const approvalKey = ({ line, environment }) => JSON.stringify([line, environment])

export const needsApproval = (backend, request, variablesJSON) => (
  Boolean(backend.runsLocalCommands) && isLocalCommand(request) && !approved.has(approvalKey(describeCommand(request, variablesJSON)))
)

export function askToRun(showConfirm, request, variablesJSON) {
  const command = describeCommand(request, variablesJSON)
  return new Promise((resolve) => {
    const run = () => {
      approved.add(approvalKey(command))
      resolve(true)
    }
    showConfirm(LOCAL_COMMAND_TEXT.title, LOCAL_COMMAND_TEXT.message(command), run, () => resolve(false), 'default', LOCAL_COMMAND_TEXT.confirm)
  })
}
