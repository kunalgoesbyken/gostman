const BARE_SHELL_WORD = /^[A-Za-z0-9_-]+$/

export const shellQuote = (text) => `'${text.replaceAll("'", `'\\''`)}'`

const POWERSHELL_QUOTES = new Set(["'", '‘', '’', '‚', '‛'])

export const powershellQuote = (text) => `'${Array.from(text, (character) => (POWERSHELL_QUOTES.has(character) ? character + character : character)).join('')}'`

export const shellWord = (text) => (BARE_SHELL_WORD.test(text) ? text : shellQuote(text))
