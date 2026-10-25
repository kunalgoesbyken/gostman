export const REQUEST_BAR_TEXT = {
  name: 'Request name',
  untitled: 'Untitled request',
  method: 'HTTP method',
  url: 'Request URL',
  urlPlaceholders: ['Enter a URL or paste a curl command', 'URL or curl command', 'URL'],
  methodPlaceholders: {
    GRPC: ['Enter the server address, for example localhost:50051', 'Server address', 'Address'],
    MCP: ['Enter the MCP server URL', 'MCP server URL', 'URL'],
  },
  send: 'Send',
  connect: 'Connect',
  disconnect: 'Disconnect',
  cancel: 'Cancel',
  save: 'Save',
  code: 'Code',
  codeHint: 'Generate code',
  codeLanguage: 'Language',
}

export const CURL_FILES_TEXT = {
  title: 'Paste the file reads?',
  message: 'This curl command reads files from this computer and sends them with the request, so only keep them if you trust where the command came from. Without them, the rest of the command is still filled in.',
  withThem: 'Paste with file reads',
  withoutThem: 'Paste without file reads',
}
