import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

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

const appVersion = JSON.parse(readFileSync(resolve(__dirname, '../wails.json'), 'utf8')).info.productVersion

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
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
  ],
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    target: 'es2022',
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
