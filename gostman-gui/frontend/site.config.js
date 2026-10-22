import { build } from 'esbuild'
import { createRequire } from 'module'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, relative, resolve, sep } from 'path'
import { guidePages } from './src/guides/pages.js'
import { docFiles, docOutputFile, docPath, docSlug } from './src/docs/manifest.js'
import { loadDocs } from './site-docs.js'

const DEFAULT_SITE_URL = 'https://gostman.com'
const SITE_URL_TOKEN = '__SITE_URL__'
const GUIDE_ENTRY = resolve('src/guides/render.jsx')
const DOCS_DIR = resolve('../../docs')

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

async function buildGuideRenderer() {
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
    loader: { '.jpg': 'file', '.png': 'file' },
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  })

  const script = outputFiles.find((file) => file.path.endsWith('.js'))
  const scriptPath = join(outdir, 'render.cjs')
  writeFileSync(scriptPath, script.text)
  const { renderGuidePage, renderDocsPage } = createRequire(scriptPath)(scriptPath)
  rmSync(outdir, { recursive: true, force: true })

  const assets = outputFiles
    .filter((file) => file !== script)
    .map((file) => ({ fileName: relative(outdir, file.path).split(sep).join('/'), source: file.contents }))
  return { renderGuidePage, renderDocsPage, assets }
}

const stylesheetsOf = (bundle) =>
  Object.values(bundle)
    .filter((item) => item.type === 'asset' && item.fileName.endsWith('.css'))
    .map((item) => `/${item.fileName}`)

export function siteMeta() {
  return {
    name: 'site-meta',
    enforce: 'post',
    transformIndexHtml: { enforce: 'pre', transform: (html) => html.replaceAll(SITE_URL_TOKEN, siteUrl) },
    async generateBundle(_options, bundle) {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(siteUrl) })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) })

      const { renderGuidePage, renderDocsPage, assets } = await buildGuideRenderer()
      const docs = loadDocs(DOCS_DIR)
      const stylesheets = stylesheetsOf(bundle)
      const emit = (fileName, source) => this.emitFile({ type: 'asset', fileName, source })
      assets.forEach((asset) => emit(asset.fileName, asset.source))
      docs.images.forEach((image) => emit(image.fileName, image.source))
      guidePages.forEach((page) => emit(`${page.path}/index.html`, renderGuidePage(page, { siteUrl, stylesheets })))
      docs.pages.forEach((page) =>
        emit(docOutputFile(page.slug), renderDocsPage(page, { siteUrl, stylesheets, nav: docs.nav })),
      )
    },
  }
}

export const siteDefine = { __SITE_URL__: JSON.stringify(siteUrl) }
