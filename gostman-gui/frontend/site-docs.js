import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { basename, extname, posix, resolve } from 'path'
import { Marked } from 'marked'
import { docFiles, docPath, docSections, docSlug } from './src/docs/manifest.js'
import { REPOSITORY_URL } from './src/lib/siteLinks.js'

const IMAGE_DIR = 'docs-images'
const DESCRIPTION_LIMIT = 155

const IMAGE_SIZES = {
  '.png': (bytes) => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }),
  '.gif': (bytes) => ({ width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) }),
}

const escapeAttribute = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const slugify = (text) => text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-')

const plainText = (tokens = []) => tokens.map((token) => (token.tokens ? plainText(token.tokens) : token.text ?? '')).join('')

function summarize(text) {
  if (text.length <= DESCRIPTION_LIMIT) return text
  const cut = text.slice(0, DESCRIPTION_LIMIT)
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

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
        if (depth === 2) state.toc.push({ id, text })
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`
      },
      link({ href, title, tokens }) {
        const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : ''
        return `<a href="${escapeAttribute(resolveHref(href, file))}"${titleAttribute}>${this.parser.parseInline(tokens)}</a>`
      },
      image({ href, text }) {
        const { src, width, height } = loadImage(href, docsDir, state.images)
        return `<img src="${src}" alt="${escapeAttribute(text)}" width="${width}" height="${height}" loading="lazy" decoding="async">`
      },
    },
  })
}

function uniqueId(base, ids) {
  const count = ids.get(base) ?? 0
  ids.set(base, count + 1)
  return count ? `${base}-${count}` : base
}

function renderDoc(entry, docsDir) {
  const { file } = entry
  const state = { title: '', toc: [], ids: new Map(), images: new Map() }
  const marked = createMarked({ file, docsDir, state })
  const tokens = marked.lexer(readFileSync(resolve(docsDir, file), 'utf8'))
  const html = marked.parser(tokens)
  if (!state.title) throw new Error(`Docs file has no title heading: ${file}`)

  const firstParagraph = tokens.find((token) => token.type === 'paragraph')
  const page = {
    file,
    slug: docSlug(file),
    comparison: Boolean(entry.comparison),
    title: state.title,
    description: summarize(plainText(firstParagraph?.tokens)),
    html,
    toc: state.toc,
  }
  return { page, images: state.images }
}

export function loadDocs(docsDir) {
  const entries = docSections.flatMap((section) => section.docs)
  const rendered = entries.map((entry) => renderDoc(entry, docsDir))
  const link = (page) => ({ href: docPath(page.slug), title: page.title })
  const titleOf = (file) => link(rendered.find(({ page }) => page.file === file).page)

  const nav = docSections.map((section) => ({
    title: section.title,
    items: section.docs.map((doc) => titleOf(doc.file)),
  }))
  const pages = rendered.map(({ page }, index) => ({
    ...page,
    previous: rendered[index - 1] ? link(rendered[index - 1].page) : null,
    next: rendered[index + 1] ? link(rendered[index + 1].page) : null,
  }))
  const images = new Map(rendered.flatMap(({ images }) => [...images]))

  return { pages, nav, images: [...images].map(([fileName, source]) => ({ fileName, source })) }
}
