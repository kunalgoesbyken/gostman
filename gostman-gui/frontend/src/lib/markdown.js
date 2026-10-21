import { shorten } from './docs/markup'
import { parseBlocks } from './markdown/blocks'
import { renderHtml } from './markdown/html'

const MAX_SOURCE_LENGTH = 200000

const CARRIAGE_RETURN_PAIR = '\r\n'
const CARRIAGE_RETURN = '\r'
const NEWLINE = '\n'
const NO_OFFSET = 0

const normalized = (source) => (
  shorten(String(source ?? ''), MAX_SOURCE_LENGTH).replaceAll(CARRIAGE_RETURN_PAIR, NEWLINE).replaceAll(CARRIAGE_RETURN, NEWLINE)
)

export const parseMarkdown = (source) => parseBlocks(normalized(source))

export const markdownToHtml = (source, { headingOffset = NO_OFFSET } = {}) => renderHtml(parseMarkdown(source), { headingOffset })
