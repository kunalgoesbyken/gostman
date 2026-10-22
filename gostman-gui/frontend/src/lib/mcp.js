export const MCP_METHOD = 'MCP'
export const MCP_PANEL = 'mcp'
export const MCP_PROTOCOL = 'mcp'
export const MCP_OK = 'OK'
export const MCP_COMMAND_PREFIX = 'stdio:'

export const isMcpRequest = (request) => request.method === MCP_METHOD

export const isLocalCommand = (request) => isMcpRequest(request) && request.url.trim().toLowerCase().startsWith(MCP_COMMAND_PREFIX)

export function toMcpTarget(request, variables) {
  const { url, headers, auth, options, inherited = [] } = request
  return { url, headers, auth, options, variables, inherited }
}

export function toMcpCall(request, variables) {
  return { target: toMcpTarget(request, variables), tool: request.mcpTool, arguments: request.mcpArguments }
}

export const findTool = (tools, name) => tools.find((tool) => tool.name === name)
