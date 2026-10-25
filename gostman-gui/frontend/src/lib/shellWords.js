const BARE_SHELL_WORD = /^[A-Za-z0-9_-]+$/

export const shellQuote = (text) => `'${text.replaceAll("'", `'\\''`)}'`

export const shellWord = (text) => (BARE_SHELL_WORD.test(text) ? text : shellQuote(text))
