export const BODY_TEXT = {
  typeLabel: 'Body type',
  editorLabel: 'Request body',
  format: 'Format',
  formatTitle: (type, chord) => `Indent the ${type} body (${chord}). {{variables}} are kept as written.`,
  cannotFormatAt: (type, { line, column, message }) => `The ${type} cannot be formatted at line ${line}, column ${column}: ${message}`,
  cannotFormat: (type, { message }) => `The ${type} cannot be formatted: ${message}`,
  goToLine: (line) => `Go to line ${line}`,
  noBody: 'No body',
  noBodyDescription: 'This request is sent without a body.',
  replacedByGraphQL: 'The method is GRAPHQL, so the body is built from the GraphQL tab and this one is not sent.',
}
