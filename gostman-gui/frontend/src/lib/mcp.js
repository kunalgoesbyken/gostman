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

export function toMcpCall(request, variables) {
  return { target: toMcpTarget(request, variables), tool: request.mcpTool, arguments: request.mcpArguments }
}

export const findTool = (tools, name) => tools.find((tool) => tool.name === name)
