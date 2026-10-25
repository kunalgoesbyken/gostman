export const UNRESOLVED_TEXT = {
  placeholder: (name) => `{{${name}}}`,
  sentAsWritten: (count) => (count === 1
    ? 'This variable is not defined, so it was sent as written:'
    : 'These variables are not defined, so they were sent as written:'),
  notDefined: (count) => (count === 1 ? 'This variable is not defined:' : 'These variables are not defined:'),
  openEnvironments: 'Open Environments',
  extractedBy: (name, request, isOnly) => `${isOnly ? 'It' : `{{${name}}}`} is set by an extract rule on "${request}", so send that request first.`,
  openSource: (request) => `Open "${request}"`,
  define: (name) => `Add {{${name}}} to the active environment`,
}
