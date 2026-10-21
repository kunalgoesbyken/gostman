import { Fragment, useMemo } from "react"
import { openExternal } from "../lib/about"
import { parseMarkdown } from "../lib/markdown"
import {
  BREAK, CODE, CODE_BLOCK, EMPHASIS, HEADING, LINK, LIST, PARAGRAPH, QUOTE, RULE, STRONG, TABLE, TEXT,
} from "../lib/markdown/nodes"
import { isAnchor } from "../lib/markdown/urls"
import { MARKDOWN_TEXT } from "../lib/markdownText"

const LINK_RELATIONSHIP = "noopener noreferrer nofollow"
const FIRST_NUMBER = 1
const HEADING_CLASSES = ["text-base font-semibold", "text-sm font-semibold", "text-sm font-semibold", "text-xs font-semibold", "text-xs font-semibold", "text-xs font-semibold"]

function Link({ node }) {
  if (isAnchor(node.href)) return inlines(node.children)
  return (
    <a
      href={node.href}
      target="_blank"
      rel={LINK_RELATIONSHIP}
      onClick={(event) => openExternal(event, node.href)}
      className="text-primary underline-offset-2 hover:underline"
    >
      {inlines(node.children)}
    </a>
  )
}

const INLINES = {
  [TEXT]: (node) => node.text,
  [BREAK]: () => <br />,
  [STRONG]: (node) => <strong>{inlines(node.children)}</strong>,
  [EMPHASIS]: (node) => <em>{inlines(node.children)}</em>,
  [CODE]: (node) => <code className="rounded bg-muted px-1 font-mono text-[0.9em]">{node.text}</code>,
  [LINK]: (node) => <Link node={node} />,
}

const inlines = (nodes) => nodes.map((node, index) => <Fragment key={index}>{INLINES[node.type](node)}</Fragment>)

function Heading({ block }) {
  const Tag = `h${block.level}`
  return <Tag dir="auto" className={`mt-3 first:mt-0 ${HEADING_CLASSES[block.level - 1]}`}>{inlines(block.children)}</Tag>
}

function ListItem({ item }) {
  const [only] = item.blocks
  const isTight = item.blocks.length === 1 && only.type === PARAGRAPH
  return <li dir="auto">{isTight ? inlines(only.children) : blocks(item.blocks)}</li>
}

function List({ block }) {
  const Tag = block.ordered ? "ol" : "ul"
  const start = block.ordered && block.start !== FIRST_NUMBER ? block.start : undefined
  const marker = block.ordered ? "list-decimal" : "list-disc"
  return (
    <Tag start={start} className={`${marker} space-y-1 ps-5`}>
      {block.items.map((item, index) => <ListItem key={index} item={item} />)}
    </Tag>
  )
}

function Row({ cells, Cell }) {
  return (
    <tr>
      {cells.map((cell, index) => (
        <Cell key={index} dir="auto" className="border border-border px-2 py-1 text-start">{inlines(cell)}</Cell>
      ))}
    </tr>
  )
}

function Table({ block }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead><Row cells={block.head} Cell="th" /></thead>
      <tbody>{block.rows.map((cells, index) => <Row key={index} cells={cells} Cell="td" />)}</tbody>
    </table>
  )
}

const BLOCKS = {
  [HEADING]: (block) => <Heading block={block} />,
  [PARAGRAPH]: (block) => <p dir="auto">{inlines(block.children)}</p>,
  [CODE_BLOCK]: (block) => <pre dir="ltr" className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs"><code>{block.text}</code></pre>,
  [LIST]: (block) => <List block={block} />,
  [QUOTE]: (block) => <blockquote dir="auto" className="space-y-2 border-s-2 border-border ps-3 text-muted-foreground">{blocks(block.blocks)}</blockquote>,
  [RULE]: () => <hr className="border-border" />,
  [TABLE]: (block) => <Table block={block} />,
}

const blocks = (nodes) => nodes.map((node, index) => <Fragment key={index}>{BLOCKS[node.type](node)}</Fragment>)

export function MarkdownView({ source, className = "" }) {
  const nodes = useMemo(() => parseMarkdown(source), [source])
  if (nodes.length === 0) return <p className={`text-xs text-muted-foreground ${className}`}>{MARKDOWN_TEXT.empty}</p>
  return <div className={`space-y-2 text-sm [overflow-wrap:anywhere] ${className}`}>{blocks(nodes)}</div>
}
