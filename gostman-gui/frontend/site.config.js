import { build } from 'esbuild'
import { createRequire } from 'module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { tmpdir } from 'os'
import { join, relative, resolve, sep } from 'path'
import { guidePages } from './src/guides/pages.js'
import { docFiles, docOutputFile, docPath, docSlug } from './src/docs/manifest.js'
import { loadDocs } from './site-docs.js'
import { CLIENT_METADATA_PATH, clientMetadata } from './src/lib/mcpClientMetadata.js'

const DEFAULT_SITE_URL = 'https://gostman.com'
const SITE_URL_TOKEN = '__SITE_URL__'
const GUIDE_ENTRY = resolve('src/guides/render.jsx')
const DOCS_DIR = resolve('../../docs')
const EMPTY_ROOT = '<div id="root"></div>'
const IMAGE_FILES = /\.(png|jpe?g|webp)$/

export const siteUrl = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '')

const sitemapPaths = ['', ...guidePages.map((page) => page.path), ...docFiles.map((file) => docPath(docSlug(file)).slice(1))]

const sitemapEntry = (url, path) => `  <url>
    <loc>${url}/${path}</loc>
  </url>`

const sitemapXml = (url) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapPaths.map((path) => sitemapEntry(url, path)).join('\n')}
</urlset>
`

const robotsTxt = (url) => `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${url}/sitemap.xml
`

const llmsLink = (url, path, title, description) => `- [${title}](${url}${path})${description ? `: ${description}` : ''}`

function llmsTxt(url, docs) {
  const pagesByPath = new Map(docs.pages.map((page) => [docPath(page.slug), page]))
  const docLink = (path) => llmsLink(url, path, pagesByPath.get(path).title, pagesByPath.get(path).description)
  return [
    '# Gostman',
    '',
    `> ${pagesByPath.get(docPath('')).description}`,
    '',
    '## Guides',
    ...guidePages.map((page) => llmsLink(url, `/${page.path}`, page.heading, page.description)),
    '',
    '## Docs',
    ...docs.nav.flatMap((section) => ['', `### ${section.title}`, ...section.items.map((item) => docLink(item.href))]),
    '',
  ].join('\n')
}

const contentHash = (source) => createHash('sha256').update(source).digest('hex')

function bundledImageUrls(bundle) {
  const urls = new Map(
    Object.values(bundle)
      .filter((item) => item.type === 'asset' && IMAGE_FILES.test(item.fileName))
      .map((asset) => [contentHash(asset.source), `/${asset.fileName}`]),
  )
  return {
    name: 'bundled-image-urls',
    setup(build) {
      build.onLoad({ filter: IMAGE_FILES }, (args) => {
        const url = urls.get(contentHash(readFileSync(args.path)))
        return url ? { contents: `export default ${JSON.stringify(url)}`, loader: 'js' } : undefined
      })
    },
  }
}

async function buildGuideRenderer(bundle) {
  const outdir = mkdtempSync(join(tmpdir(), 'gostman-guides-'))
  const { outputFiles } = await build({
    entryPoints: [GUIDE_ENTRY],
    outdir,
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    publicPath: '/',
    assetNames: 'assets/[name]-[hash]',
    loader: { '.jpg': 'file', '.png': 'file', '.webp': 'file' },
    plugins: [bundledImageUrls(bundle)],
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  })

  const script = outputFiles.find((file) => file.path.endsWith('.js'))
  const scriptPath = join(outdir, 'render.cjs')
  writeFileSync(scriptPath, script.text)
  const { renderGuidePage, renderDocsPage, renderLandingMarkup } = createRequire(scriptPath)(scriptPath)
  rmSync(outdir, { recursive: true, force: true })

  const assets = outputFiles
    .filter((file) => file !== script)
    .map((file) => ({ fileName: relative(outdir, file.path).split(sep).join('/'), source: file.contents }))
  return { renderGuidePage, renderDocsPage, renderLandingMarkup, assets }
}

const stylesheetsOf = (bundle) =>
  Object.values(bundle)
    .filter((item) => item.type === 'chunk' && item.isEntry)
    .flatMap((chunk) => [...(chunk.viteMetadata?.importedCss ?? [])])
    .map((fileName) => `/${fileName}`)

export function siteMeta() {
  return {
    name: 'site-meta',
    enforce: 'post',
    transformIndexHtml: { enforce: 'pre', transform: (html) => html.replaceAll(SITE_URL_TOKEN, siteUrl) },
    async generateBundle(_options, bundle) {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(siteUrl) })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) })
      this.emitFile({ type: 'asset', fileName: CLIENT_METADATA_PATH.slice(1), source: JSON.stringify(clientMetadata(siteUrl), null, 2) })

      const { renderGuidePage, renderDocsPage, renderLandingMarkup, assets } = await buildGuideRenderer(bundle)
      const docs = loadDocs(DOCS_DIR)
      const stylesheets = stylesheetsOf(bundle)
      const emit = (fileName, source) => this.emitFile({ type: 'asset', fileName, source })
      emit('llms.txt', llmsTxt(siteUrl, docs))
      assets.forEach((asset) => emit(asset.fileName, asset.source))
      docs.images.forEach((image) => emit(image.fileName, image.source))
      guidePages.forEach((page) => emit(`${page.path}/index.html`, renderGuidePage(page, { siteUrl, stylesheets })))
      docs.pages.forEach((page) =>
        emit(docOutputFile(page.slug), renderDocsPage(page, { siteUrl, stylesheets, nav: docs.nav })),
      )
      const landing = bundle['index.html']
      if (!String(landing.source).includes(EMPTY_ROOT)) this.error('index.html has no empty root element to prerender into')
      landing.source = String(landing.source).replace(EMPTY_ROOT, `<div id="root">${renderLandingMarkup()}</div>`)
    },
  }
}

export const siteDefine = { __SITE_URL__: JSON.stringify(siteUrl) }
