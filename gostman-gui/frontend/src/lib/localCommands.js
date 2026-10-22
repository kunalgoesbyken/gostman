import { isLocalCommand } from './mcp'
import { parseVariableMap, substitutePlaceholders } from './placeholders'

export const LOCAL_COMMAND_TEXT = {
  title: 'Run a program on this computer?',
  message: (line) => `This request starts a local MCP server with your user account:\n\n${line}\n\nRun it only if you know what this program does. Gostman asks again when the command changes or the app restarts.`,
  confirm: 'Run',
  notApproved: 'This request starts a program on this computer. Send it once from its own tab and confirm the command, then run it again.',
}

const approved = new Set()

export function commandLineOf(request, variablesJSON) {
  const line = request.url.trim()
  const variables = parseVariableMap(variablesJSON)
  return variables ? substitutePlaceholders(line, variables) : line
}

export const needsApproval = (backend, request, variablesJSON) => (
  Boolean(backend.runsLocalCommands) && isLocalCommand(request) && !approved.has(commandLineOf(request, variablesJSON))
)

export function askToRun(showConfirm, request, variablesJSON) {
  const line = commandLineOf(request, variablesJSON)
  return new Promise((resolve) => {
    const run = () => {
      approved.add(line)
      resolve(true)
    }
    showConfirm(LOCAL_COMMAND_TEXT.title, LOCAL_COMMAND_TEXT.message(line), run, () => resolve(false), 'default', LOCAL_COMMAND_TEXT.confirm)
  })
}
