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
import { REPOSITORY } from './src/lib/siteLinks.js'
import { FAQ } from './src/components/landing/faq.js'

const DEFAULT_SITE_URL = 'https://gostman.com'
const SITE_URL_TOKEN = '__SITE_URL__'
const APP_VERSION_TOKEN = '__APP_VERSION__'
const GUIDE_ENTRY = resolve('src/guides/render.jsx')
const DOCS_DIR = resolve('../../docs')
const EMPTY_ROOT = '<div id="root"></div>'
const IMAGE_FILES = /\.(png|jpe?g|webp)$/
const STARS_TIMEOUT_MS = 4000
export const DOCS_ENTRY = 'docs'

export const siteUrl = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '')

const appVersion = JSON.parse(readFileSync(resolve('../wails.json'), 'utf8')).info.productVersion

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
    '## Optional',
    llmsLink(url, '/llms-full.txt', 'Full documentation', 'every docs page in one Markdown file'),
    '',
  ].join('\n')
}

const llmsFullTxt = () => docFiles.map((file) => readFileSync(join(DOCS_DIR, file), 'utf8').trim()).join('\n\n---\n\n') + '\n'

const faqJsonLd = () => JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(({ question, answer }) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })),
})

const withHeadScript = (html, json) => html.replace('</head>', `<script type="application/ld+json">${json}</script>\n</head>`)

const notFoundHtml = (url, stylesheets) => `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="/theme-boot.js"></script>
<title>Page not found | Gostman</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon.ico" sizes="any">
${stylesheets.map((href) => `<link rel="stylesheet" href="${href}">`).join('')}
<style>
.nf{min-height:100dvh;display:grid;align-items:center;padding:clamp(1.5rem,6vw,5rem)}
.nf main{width:100%;max-width:42rem;margin:0 auto}
.nf .code{margin:0;font-size:clamp(5rem,22vw,11rem);font-weight:700;letter-spacing:-.06em;line-height:.9;color:hsl(var(--border))}
.nf h1{margin:1.5rem 0 .5rem;font-size:1.5rem;font-weight:600;letter-spacing:-.02em}
.nf p{margin:0 0 2rem;max-width:36ch;line-height:1.6;color:hsl(var(--muted-foreground))}
.nf nav{display:flex;flex-wrap:wrap;gap:.75rem}
.nf a{display:inline-flex;align-items:center;height:2.5rem;padding:0 1rem;border:1px solid hsl(var(--border));border-radius:.5rem;font-size:.875rem;font-weight:500;color:inherit;text-decoration:none;transition:background-color .15s,transform .15s}
.nf a:first-child{background:hsl(var(--primary));border-color:hsl(var(--primary));color:hsl(var(--primary-foreground))}
.nf a:hover{background:hsl(var(--muted))}
.nf a:first-child:hover{background:hsl(var(--primary));opacity:.9}
.nf a:active{transform:translateY(1px)}
.nf a:focus-visible{outline:2px solid hsl(var(--ring));outline-offset:2px}
</style>
</head>
<body class="nf">
<main>
<div class="code" aria-hidden="true">404</div>
<h1>Page not found</h1>
<p>There is no page at this address. It may have moved, or the link may be mistyped.</p>
<nav><a href="${url}/">Home</a><a href="${url}/docs">Docs</a><a href="${url}/web">Web app</a></nav>
</main>
</body>
</html>
`

const docPaths = new Set(docFiles.map((file) => docPath(docSlug(file))))

const guideLinks = (page) => [...(page.links ?? []), ...page.sections.flatMap((section) => section.links ?? [])]

const missingGuideDocs = () =>
  guidePages.flatMap(guideLinks).map((link) => link.href).filter((href) => href.startsWith(docPath('')) && !docPaths.has(href))

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
    define: { 'process.env.NODE_ENV': '"production"', ...siteDefine },
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

export const chunkClosure = (bundle, fileName, seen = new Set()) => {
  if (seen.has(fileName)) return seen
  seen.add(fileName)
  bundle[fileName].imports.forEach((imported) => chunkClosure(bundle, imported, seen))
  return seen
}

function docsScripts(bundle) {
  const entry = Object.values(bundle).find((item) => item.type === 'chunk' && item.isEntry && item.name === DOCS_ENTRY)
  if (!entry) return []
  const imports = [...chunkClosure(bundle, entry.fileName)].filter((fileName) => fileName !== entry.fileName)
  return [{ src: `/${entry.fileName}` }, ...imports.map((fileName) => ({ src: `/${fileName}`, preload: true }))]
}

const stylesheetsOf = (bundle) =>
  Object.values(bundle)
    .filter((item) => item.type === 'chunk' && item.isEntry && item.name !== DOCS_ENTRY)
    .flatMap((chunk) => [...(chunk.viteMetadata?.importedCss ?? [])])
    .map((fileName) => `/${fileName}`)

export function siteMeta() {
  return {
    name: 'site-meta',
    enforce: 'post',
    transformIndexHtml: { enforce: 'pre', transform: (html) => html.replaceAll(SITE_URL_TOKEN, siteUrl).replaceAll(APP_VERSION_TOKEN, appVersion) },
    async generateBundle(_options, bundle) {
      const missingDocs = missingGuideDocs()
      if (missingDocs.length) this.error(`Guide pages link to docs that do not exist: ${missingDocs.join(', ')}`)
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(siteUrl) })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) })
      this.emitFile({ type: 'asset', fileName: CLIENT_METADATA_PATH.slice(1), source: JSON.stringify(clientMetadata(siteUrl), null, 2) })

      const { renderGuidePage, renderDocsPage, renderLandingMarkup, assets } = await buildGuideRenderer(bundle)
      const docs = loadDocs(DOCS_DIR)
      const stylesheets = stylesheetsOf(bundle)
      const emit = (fileName, source) => this.emitFile({ type: 'asset', fileName, source })
      emit('llms.txt', llmsTxt(siteUrl, docs))
      emit('llms-full.txt', llmsFullTxt())
      emit('404.html', notFoundHtml(siteUrl, stylesheets))
      assets.forEach((asset) => emit(asset.fileName, asset.source))
      docs.images.forEach((image) => emit(image.fileName, image.source))
      guidePages.forEach((page) => emit(`${page.path}/index.html`, renderGuidePage(page, { siteUrl, stylesheets })))
      const searchRef = this.emitFile({ type: 'asset', name: 'docs-search.json', source: JSON.stringify(docs.search) })
      const searchUrl = `/${this.getFileName(searchRef)}`
      const scripts = docsScripts(bundle)
      const shared = { siteUrl, stylesheets, scripts, nav: docs.nav, directory: docs.directory, searchUrl }
      docs.pages.forEach((page) => emit(docOutputFile(page.slug), renderDocsPage(page, shared)))
      const landing = bundle['index.html']
      if (!String(landing.source).includes(EMPTY_ROOT)) this.error('index.html has no empty root element to prerender into')
      landing.source = withHeadScript(String(landing.source).replace(EMPTY_ROOT, `<div id="root">${renderLandingMarkup()}</div>`), faqJsonLd())
    },
  }
}

const GITHUB_HEADERS = { Accept: 'application/vnd.github+json', 'User-Agent': 'Gostman-Site-Build' }

const fetchRepository = (token) =>
  fetch(`https://api.github.com/repos/${REPOSITORY}`, {
    headers: token ? { ...GITHUB_HEADERS, Authorization: `Bearer ${token}` } : GITHUB_HEADERS,
    signal: AbortSignal.timeout(STARS_TIMEOUT_MS),
  })

async function fetchGitHubStars() {
  try {
    const authorized = await fetchRepository(process.env.GITHUB_TOKEN)
    const response = authorized.status === 401 ? await fetchRepository() : authorized
    if (!response.ok) return null
    const { stargazers_count: stars } = await response.json()
    return Number.isFinite(stars) ? stars : null
  } catch {
    return null
  }
}

const githubStars = await fetchGitHubStars()

export const siteDefine = { __SITE_URL__: JSON.stringify(siteUrl), __GITHUB_STARS__: JSON.stringify(githubStars), __APP_VERSION__: JSON.stringify(appVersion) }
