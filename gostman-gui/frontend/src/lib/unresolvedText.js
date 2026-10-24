export const UNRESOLVED_TEXT = {
  placeholder: (name) => `{{${name}}}`,
  sentAsWritten: (count) => (count === 1
    ? 'This variable is not defined, so it was sent as written:'
    : 'These variables are not defined, so they were sent as written:'),
  notDefined: (count) => (count === 1 ? 'This variable is not defined:' : 'These variables are not defined:'),
  openEnvironments: 'Open Environments',
}
