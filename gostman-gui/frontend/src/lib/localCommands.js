import { isLocalCommand, trimAsciiSpace } from './mcp'
import { parseVariableMap, substitutePlaceholders } from './placeholders'
import { isSentRow, parseRows } from './rows'

export const LOCAL_COMMAND_TEXT = {
  title: 'Run a program on this computer?',
  message: ({ line, environment }) => [
    'This request starts a local MCP server with your user account:',
    { code: line },
    ...(environment.length > 0 ? ['With these environment variables from the Headers tab:', { code: environment.join('\n') }] : []),
    'Run it only if you know what this program does. Gostman asks again when the command or its environment changes, or the app restarts.',
  ],
  confirm: 'Run',
  notApproved: 'This request starts a program on this computer. Send it once from its own tab and confirm the command, then run it again.',
}

const approved = new Set()

export function describeCommand(request, variablesJSON) {
  const variables = parseVariableMap(variablesJSON) || new Map()
  const substitute = (text) => substitutePlaceholders(text, variables)
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
