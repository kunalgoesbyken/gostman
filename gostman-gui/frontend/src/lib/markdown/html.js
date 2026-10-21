import { html, toSource, trusted } from '../docs/markup'
import {
  BREAK, CODE, CODE_BLOCK, EMPHASIS, HEADING, LINK, LIST, PARAGRAPH, QUOTE, RULE, STRONG, TABLE, TEXT,
} from './nodes'
import { isAnchor } from './urls'

const MAX_HEADING = 6
const LINK_RELATIONSHIP = 'noopener noreferrer nofollow'
const FIRST_NUMBER = 1

const INLINES = {
  [TEXT]: (node) => node.text,
  [BREAK]: () => trusted('<br>'),
  [STRONG]: (node) => html`<strong>${inlines(node.children)}</strong>`,
  [EMPHASIS]: (node) => html`<em>${inlines(node.children)}</em>`,
  [CODE]: (node) => html`<code>${node.text}</code>`,
  [LINK]: link,
}

const EXTERNAL_ATTRIBUTES = trusted(` target="_blank" rel="${LINK_RELATIONSHIP}"`)

function link(node) {
  const attributes = isAnchor(node.href) ? '' : EXTERNAL_ATTRIBUTES
  return html`<a href="${node.href}"${attributes}>${inlines(node.children)}</a>`
}

const inlines = (nodes) => nodes.map((node) => INLINES[node.type](node))

const headingTag = (level, offset) => `h${Math.min(MAX_HEADING, level + offset)}`

function heading(block, options) {
  const tag = headingTag(block.level, options.headingOffset)
  return html`${trusted(`<${tag} dir="auto">`)}${inlines(block.children)}${trusted(`</${tag}>`)}`
}

function listItem(item, options) {
  const [only] = item.blocks
  const content = item.blocks.length === 1 && only.type === PARAGRAPH ? inlines(only.children) : blocks(item.blocks, options)
  return html`<li dir="auto">${content}</li>`
}

function list(block, options) {
  const items = block.items.map((item) => listItem(item, options))
  if (!block.ordered) return html`<ul>${items}</ul>`
  const start = block.start === FIRST_NUMBER ? '' : trusted(` start="${Number(block.start)}"`)
  return html`<ol${start}>${items}</ol>`
}

const cell = (tag, content) => html`${trusted(`<${tag} dir="auto">`)}${inlines(content)}${trusted(`</${tag}>`)}`

const row = (tag) => (cells) => html`<tr>${cells.map((content) => cell(tag, content))}</tr>`

const table = (block) => html`<table><thead>${row('th')(block.head)}</thead><tbody>${block.rows.map(row('td'))}</tbody></table>`

const BLOCKS = {
  [HEADING]: heading,
  [PARAGRAPH]: (block) => html`<p dir="auto">${inlines(block.children)}</p>`,
  [CODE_BLOCK]: (block) => html`<pre dir="ltr"><code>${block.text}</code></pre>`,
  [LIST]: list,
  [QUOTE]: (block, options) => html`<blockquote dir="auto">${blocks(block.blocks, options)}</blockquote>`,
  [RULE]: () => trusted('<hr>'),
  [TABLE]: table,
}

const blocks = (nodes, options) => nodes.map((node) => BLOCKS[node.type](node, options))

export const renderHtml = (nodes, options) => toSource(html`${blocks(nodes, options)}`)
