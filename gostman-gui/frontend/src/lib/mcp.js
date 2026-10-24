export const MCP_METHOD = 'MCP'
export const MCP_PANEL = 'mcp'
export const MCP_PROTOCOL = 'mcp'
export const MCP_OK = 'OK'
export const MCP_COMMAND_PREFIX = 'stdio:'

export const isMcpRequest = (request) => request.method === MCP_METHOD

const ASCII_SPACE = new Set([' ', '\t', '\r', '\n', '\v', '\f'])

export function trimAsciiSpace(text) {
  let start = 0
  let end = text.length
  while (start < end && ASCII_SPACE.has(text[start])) start += 1
  while (end > start && ASCII_SPACE.has(text[end - 1])) end -= 1
  return text.slice(start, end)
}

export const isLocalCommand = (request) => isMcpRequest(request) && trimAsciiSpace(request.url).startsWith(MCP_COMMAND_PREFIX)

export function toMcpTarget(request, variables) {
  const { url, headers, auth, options, inherited = [] } = request
  return { url, headers, auth, options, variables, inherited }
}

export const MCP_CALL_TOOL = 'tools/call'
export const MCP_READ_RESOURCE = 'resources/read'
export const MCP_GET_PROMPT = 'prompts/get'

export const MCP_OPERATIONS = [
  MCP_CALL_TOOL, 'tools/list', MCP_READ_RESOURCE, 'resources/list', 'resources/templates/list', MCP_GET_PROMPT, 'prompts/list',
]

export const mcpOperation = (request) => request.mcpMethod || MCP_CALL_TOOL

export const takesArguments = (operation) => operation === MCP_CALL_TOOL || operation === MCP_GET_PROMPT

export const namesItem = (operation) => takesArguments(operation) || operation === MCP_READ_RESOURCE

export function toMcpCall(request, variables) {
  return { target: toMcpTarget(request, variables), method: mcpOperation(request), tool: request.mcpTool, arguments: request.mcpArguments }
}

export const findTool = (tools, name) => tools.find((tool) => tool.name === name)
