export const MCP_METHOD = 'MCP'
export const MCP_PANEL = 'mcp'
export const MCP_PROTOCOL = 'mcp'
export const MCP_OK = 'OK'

export const isMcpRequest = (request) => request.method === MCP_METHOD

export function toMcpTarget(request, variables) {
  const { url, headers, auth, options } = request
  return { url, headers, auth, options, variables }
}

export function toMcpCall(request, variables) {
  return { target: toMcpTarget(request, variables), tool: request.mcpTool, arguments: request.mcpArguments }
}

export const findTool = (tools, name) => tools.find((tool) => tool.name === name)
