import { defineConfig, normalizePath } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import { siteDefine, siteMeta } from './site.config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function renameHtmlEntry(from, to) {
  return {
    name: 'rename-html-entry',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const asset = bundle[from]
      if (!asset) return
      delete bundle[from]
      asset.fileName = to
      bundle[to] = asset
    },
  }
}

function serveWebEntryInDev(entry) {
  return {
    name: 'serve-web-entry-in-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next()
        const [pathname] = req.url.split('?')
        const isAsset = /\.[^/]+$/.test(pathname)
        const isInternal = pathname.startsWith('/@') || pathname.startsWith('/node_modules/')
        const isApi = pathname.startsWith('/api/')
        if (!isAsset && !isInternal && !isApi) {
          req.url = `/${entry}${req.url.slice(pathname.length)}`
        }
        next()
      })
    },
  }
}

const chunkClosure = (bundle, fileName, seen = new Set()) => {
  if (seen.has(fileName)) return seen
  seen.add(fileName)
  bundle[fileName].imports.forEach((imported) => chunkClosure(bundle, imported, seen))
  return seen
}

const withLinks = (html, links) => String(html).replace('</head>', `${links.join('\n')}\n</head>`)

function preloadedRoutePage(route, module) {
  const moduleId = normalizePath(resolve(__dirname, module))
  return {
    name: 'preloaded-route-page',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((item) => item.type === 'chunk')
      const target = chunks.find((chunk) => chunk.isDynamicEntry && moduleId in chunk.modules)
      const page = bundle['index.html']
      if (!target || !page) return
      const loaded = new Set(chunks.filter((chunk) => chunk.isEntry).flatMap((chunk) => [...chunkClosure(bundle, chunk.fileName)]))
      const files = [...chunkClosure(bundle, target.fileName)].filter((fileName) => !loaded.has(fileName))
      const styles = files.flatMap((fileName) => [...(bundle[fileName].viteMetadata?.importedCss ?? [])])
      const preloads = [
        ...styles.map((fileName) => `<link rel="stylesheet" href="/${fileName}">`),
        ...files.map((fileName) => `<link rel="modulepreload" crossorigin href="/${fileName}">`),
      ]
      const prefetches = [
        ...styles.map((fileName) => `<link rel="prefetch" as="style" href="/${fileName}">`),
        ...files.map((fileName) => `<link rel="prefetch" as="script" crossorigin href="/${fileName}">`),
      ]
      this.emitFile({ type: 'asset', fileName: `${route}/index.html`, source: withLinks(page.source, preloads) })
      page.source = withLinks(page.source, prefetches)
    },
  }
}

const SANDBOX_WORKER_PREFIX = 'assets/sandbox.worker.'

function stampServiceWorker() {
  let assets = []
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    writeBundle(_options, bundle) {
      assets = Object.values(bundle)
        .filter((item) => (item.type === 'chunk' || item.fileName.endsWith('.css')) && !item.fileName.startsWith(SANDBOX_WORKER_PREFIX))
        .map((item) => `/${item.fileName}`)
        .sort()
    },
    closeBundle() {
      const file = resolve(__dirname, 'dist-web/sw.js')
      const buildId = createHash('sha1').update(assets.join(',')).digest('hex').slice(0, 10)
      const source = readFileSync(file, 'utf8').replace('__BUILD_ID__', buildId).replace('__BUILD_ASSETS__', JSON.stringify(assets))
      writeFileSync(file, source)
    },
  }
}

const appVersion = JSON.parse(readFileSync(resolve(__dirname, '../wails.json'), 'utf8')).info.productVersion

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion), ...siteDefine },
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      include: ['buffer', 'process', 'util', 'stream', 'events', 'path', 'querystring', 'url', 'string_decoder', 'http', 'https', 'os', 'assert', 'constants', 'zlib', 'tty', 'domain', 'punycode', 'console', 'vm'],
    }),
    serveWebEntryInDev('index-web.html'),
    renameHtmlEntry('index-web.html', 'index.html'),
    preloadedRoutePage('web', 'src/components/Workspace.jsx'),
    stampServiceWorker(),
    siteMeta(),
  ],
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: resolve(__dirname, 'index-web.html'),
      output: {
        entryFileNames: 'assets/index.[hash].js',
        assetFileNames: (assetInfo) =>
          assetInfo.name === 'index-web.css'
            ? 'assets/index.[hash][extname]'
            : 'assets/[name].[hash][extname]',
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/proxy': { target: 'http://localhost:8787', xfwd: true }
    }
  }
})
