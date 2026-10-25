import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { basename, extname, posix, resolve } from 'path'
import { Lexer, Marked, Renderer } from 'marked'
import copyIcon from '@iconify-icons/solar/copy-linear.js'
import checkIcon from '@iconify-icons/solar/check-read-linear.js'
import noteIcon from '@iconify-icons/solar/info-circle-linear.js'
import tipIcon from '@iconify-icons/solar/lightbulb-linear.js'
import importantIcon from '@iconify-icons/solar/danger-square-linear.js'
import warningIcon from '@iconify-icons/solar/danger-triangle-linear.js'
import cautionIcon from '@iconify-icons/solar/danger-circle-linear.js'
import { HOME_FILE, docFiles, docPath, docSections, docSlug } from './src/docs/manifest.js'
import { DOCS_TEXT } from './src/lib/docsText.js'
import { REPOSITORY_URL } from './src/lib/siteLinks.js'

const IMAGE_DIR = 'docs-images'
const DESCRIPTION_LIMIT = 155
const TOC_DEPTHS = [2, 3]
const SECTION_DEPTHS = [2, 3, 4]
const ALERT_ICONS = { note: noteIcon, tip: tipIcon, important: importantIcon, warning: warningIcon, caution: cautionIcon }
const ALERT_KINDS = Object.keys(ALERT_ICONS)
const STEP_PREFIX = /^(\d+)\.\s+/

const WEBP_SIZES = {
  'VP8 ': (bytes) => ({ width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff }),
  VP8L: (bytes) => {
    const bits = bytes.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  },
  VP8X: (bytes) => ({ width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 }),
}

const IMAGE_SIZES = {
  '.png': (bytes) => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }),
  '.gif': (bytes) => ({ width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) }),
  '.webp': (bytes) => WEBP_SIZES[bytes.toString('ascii', 12, 16)](bytes),
}

const escapeAttribute = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const slugify = (text) => text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-')

const HTML_ESCAPES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

const unescapeHtml = (text) => text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => HTML_ESCAPES[entity])

const plainText = (tokens = []) =>
  tokens.map((token) => (token.tokens ? plainText(token.tokens) : unescapeHtml(token.text ?? ''))).join('')

const tableText = (token) => [...token.header, ...token.rows.flat()].map((cell) => plainText(cell.tokens)).join(' ')

function tokenText(token) {
  if (token.type === 'table') return tableText(token)
  if (token.items) return token.items.map(tokenText).join(' ')
  if (token.type === 'code') return token.text
  if (token.tokens) return plainText(token.tokens)
  return unescapeHtml(token.text ?? '')
}

const collapse = (text) => text.replace(/\s+/g, ' ').trim()

const icon = ({ body }, className) =>
  `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">${body}</svg>`

const COPY_BUTTON = `<button type="button" class="docs-copy" data-copy-code aria-label="${DOCS_TEXT.code.copy}" title="${DOCS_TEXT.code.copy}">${icon(copyIcon, 'docs-copy-idle')}${icon(checkIcon, 'docs-copy-done')}</button>`

function shorten(text, limit) {
  if (text.length <= limit) return text
  const cut = text.slice(0, limit)
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

const summarize = (text) => shorten(text, DESCRIPTION_LIMIT)

function isAbsoluteUrl(href) {
  try {
    new URL(href)
    return true
  } catch {
    return false
  }
}

function resolveHref(href, file) {
  if (isAbsoluteUrl(href) || href.startsWith('#') || href.startsWith('/')) return href
  const [path, hash = ''] = href.split('#')
  const target = posix.join(posix.dirname(file), path)
  const suffix = hash ? `#${hash}` : ''
  if (docFiles.includes(target)) return `${docPath(docSlug(target))}${suffix}`
  return `${REPOSITORY_URL}/blob/main/${posix.join('docs', target)}${suffix}`
}

function loadImage(href, docsDir, images) {
  const source = resolve(docsDir, href)
  const extension = extname(source)
  const measure = IMAGE_SIZES[extension]
  if (!measure) throw new Error(`Unsupported docs image type: ${href}`)
  if (!existsSync(source)) throw new Error(`Missing docs image: ${href}`)

  const bytes = readFileSync(source)
  const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 8)
  const fileName = `${IMAGE_DIR}/${basename(source, extension)}-${hash}${extension}`
  images.set(fileName, bytes)
  return { src: `/${fileName}`, ...measure(bytes) }
}

function uniqueId(base, ids) {
  const count = ids.get(base) ?? 0
  ids.set(base, count + 1)
  return count ? `${base}-${count}` : base
}

const anchorTargets = (ids = []) => ids.map((id) => `<span id="${id}" class="docs-alias"></span>`).join('')

function invertAliases(aliases = {}) {
  const byTarget = new Map()
  Object.entries(aliases).forEach(([alias, target]) => byTarget.set(target, [...(byTarget.get(target) ?? []), alias]))
  return byTarget
}

function assertAnchors(file, ids, aliases = {}) {
  const missing = Object.values(aliases).find((target) => !ids.includes(target))
  if (missing) throw new Error(`Docs alias target #${missing} is not a heading in ${file}`)
  const all = [...ids, ...Object.keys(aliases)]
  const duplicate = all.find((id, index) => all.indexOf(id) !== index)
  if (duplicate) throw new Error(`Docs anchor #${duplicate} is used twice in ${file}`)
}

function headingContent(text, inline, depth) {
  const step = depth === 2 && text.match(STEP_PREFIX)
  if (!step) return inline
  return `<span class="docs-step">${step[1]}</span>${escapeAttribute(text.slice(step[0].length))}`
}

function alertKind(tokens) {
  const first = tokens[0]
  if (first?.type !== 'paragraph') return null
  return ALERT_KINDS.find((kind) => first.text.startsWith(`[!${kind.toUpperCase()}]`)) ?? null
}

function renderAlert(parser, tokens, kind) {
  const [first, ...rest] = tokens
  const body = first.text.slice(kind.length + 3).trim()
  const lead = body ? `<p>${parser.parseInline(Lexer.lexInline(body))}</p>` : ''
  return `<div class="docs-callout" data-kind="${kind}" role="note"><p class="docs-callout-title">${icon(ALERT_ICONS[kind], 'docs-callout-icon')}${DOCS_TEXT.callouts[kind]}</p>${lead}${parser.parse(rest)}</div>\n`
}

function renderCode(text, lang) {
  const name = (lang ?? '').trim().split(/\s/)[0].toLowerCase()
  const label = DOCS_TEXT.languages[name] ?? name
  return `<div class="docs-code"><div class="docs-code-bar"><span>${escapeAttribute(label)}</span>${COPY_BUTTON}</div><pre><code>${escapeAttribute(text)}</code></pre></div>\n`
}

function createMarked({ file, docsDir, state }) {
  return new Marked({
    renderer: {
      heading({ tokens, depth }) {
        const text = plainText(tokens)
        if (depth === 1) {
          state.title = text
          return ''
        }
        const id = uniqueId(slugify(text), state.ids)
        state.headings.push({ id, text, depth })
        if (TOC_DEPTHS.includes(depth)) state.toc.push({ id, text, depth })
        const content = headingContent(text, this.parser.parseInline(tokens), depth)
        return `<h${depth} id="${id}">${anchorTargets(state.aliases.get(id))}<a class="docs-anchor" href="#${id}">${content}</a></h${depth}>\n`
      },
      link({ href, title, tokens }) {
        const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : ''
        return `<a href="${escapeAttribute(resolveHref(href, file))}"${titleAttribute}>${this.parser.parseInline(tokens)}</a>`
      },
      image({ href, text }) {
        const { src, width, height } = loadImage(href, docsDir, state.images)
        return `<img src="${src}" alt="${escapeAttribute(text)}" width="${width}" height="${height}" loading="lazy" decoding="async">`
      },
      code({ text, lang }) {
        return renderCode(text, lang)
      },
      blockquote({ tokens }) {
        const kind = alertKind(tokens)
        return kind ? renderAlert(this.parser, tokens, kind) : `<blockquote>\n${this.parser.parse(tokens)}</blockquote>\n`
      },
      table(token) {
        return `<div class="docs-table">${Renderer.prototype.table.call(this, token)}</div>\n`
      },
    },
  })
}

const introTokens = (tokens) => {
  const end = tokens.findIndex((token) => token.type === 'heading' && token.depth === 2)
  return end === -1 ? tokens : tokens.slice(0, end)
}

function searchSections(tokens, headings, page) {
  const sections = [{ id: '', heading: '', parts: [] }]
  let cursor = 0
  tokens.forEach((token) => {
    if (token.type === 'heading' && token.depth === 1) return
    if (token.type === 'heading' && SECTION_DEPTHS.includes(token.depth)) {
      const text = plainText(token.tokens)
      const index = headings.findIndex((heading, at) => at >= cursor && heading.text === text)
      cursor = index === -1 ? cursor : index + 1
      sections.push({ id: index === -1 ? '' : headings[index].id, heading: text, parts: [] })
      return
    }
    sections.at(-1).parts.push(tokenText(token))
  })
  return sections
    .map((section) => searchRecord(page, section))
    .filter(([, section, , text]) => section || text)
}

function searchRecord(page, section) {
  const href = section.id ? `${page.href}#${section.id}` : page.href
  return [page.title, section.heading, href, collapse(section.parts.join(' '))]
}

function renderDoc(entry, section, docsDir) {
  const { file } = entry
  const state = { title: '', toc: [], headings: [], ids: new Map(), images: new Map(), aliases: invertAliases(entry.aliases) }
  const marked = createMarked({ file, docsDir, state })
  const home = file === HOME_FILE
  const allTokens = marked.lexer(readFileSync(resolve(docsDir, file), 'utf8'))
  const tokens = home ? introTokens(allTokens) : allTokens
  const leadIndex = tokens.findIndex((token) => token.type !== 'space' && !(token.type === 'heading' && token.depth === 1))
  const hasLead = tokens[leadIndex]?.type === 'paragraph'
  const lead = hasLead ? marked.parser([tokens[leadIndex]]) : ''
  const html = marked.parser(hasLead ? tokens.filter((_, index) => index !== leadIndex) : tokens)
  if (!state.title) throw new Error(`Docs file has no title heading: ${file}`)
  assertAnchors(file, state.headings.map((heading) => heading.id), entry.aliases)

  const firstParagraph = tokens.find((token) => token.type === 'paragraph')
  const slug = docSlug(file)
  const page = {
    file,
    slug,
    href: docPath(slug),
    home,
    group: { label: section.title, href: docPath(docSlug(section.docs[0].file)) },
    comparison: Boolean(entry.comparison),
    outline: Boolean(entry.outline),
    title: state.title,
    label: entry.label ?? state.title,
    description: summarize(plainText(firstParagraph?.tokens)),
    editUrl: `${REPOSITORY_URL}/edit/main/docs/${file}`,
    lead,
    html,
    toc: state.toc,
  }
  return { page, images: state.images, search: searchSections(tokens, state.headings, page) }
}

const outlineOf = (page) => {
  const depth = Math.min(...page.toc.map((entry) => entry.depth))
  return page.toc.filter((entry) => entry.depth === depth).map((entry) => ({ href: `${page.href}#${entry.id}`, text: entry.text }))
}

const navItem = (page) => ({
  href: page.href,
  label: page.label,
  ...(page.outline && page.toc.length ? { children: outlineOf(page) } : {}),
})

const link = (page) => ({ href: page.href, label: page.label })

export function loadDocs(docsDir) {
  const rendered = docSections.flatMap((section) => section.docs.map((entry) => renderDoc(entry, section, docsDir)))
  const pageOf = (file) => rendered.find(({ page }) => page.file === file).page

  const nav = docSections.map((section) => ({
    title: section.title,
    items: section.docs.map((doc) => navItem(pageOf(doc.file))),
  }))
  const directory = docSections.map((section) => ({
    title: section.title,
    anchors: [slugify(section.title), ...(section.aliases ?? [])],
    items: section.docs.map((doc) => ({ ...link(pageOf(doc.file)), description: pageOf(doc.file).description })),
  }))
  const pages = rendered.map(({ page }, index) => ({
    ...page,
    previous: rendered[index - 1] ? link(rendered[index - 1].page) : null,
    next: rendered[index + 1] ? link(rendered[index + 1].page) : null,
  }))
  assertAnchors(HOME_FILE, directory.flatMap((section) => section.anchors))
  const images = new Map(rendered.flatMap(({ images }) => [...images]))
  const search = rendered.flatMap((entry) => entry.search)

  return { pages, nav, directory, search, images: [...images].map(([fileName, source]) => ({ fileName, source })) }
}
