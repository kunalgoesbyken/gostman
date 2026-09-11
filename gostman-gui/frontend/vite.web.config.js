import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * The web build uses `index-web.html` as its Rollup entry so that the desktop
 * `index.html` is never touched. Vite names the emitted HTML after the input
 * file, so it would land at `dist-web/index-web.html`. Vercel serves
 * `index.html` from `outputDirectory`, so rename the emitted asset in-bundle.
 */
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

/**
 * In dev, Vite's middleware resolves `/` to the root `index.html` (the desktop
 * entry). Rewrite bare/HTML navigations to the web entry instead.
 */
function serveWebEntryInDev(entry) {
  return {
    name: 'serve-web-entry-in-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next()
        const [pathname] = req.url.split('?')
        if (pathname === '/' || pathname === '/index.html') {
          req.url = `/${entry}${req.url.slice(pathname.length)}`
        }
        next()
      })
    },
  }
}

// Web version config - uses web-main.jsx -> WebApp.jsx with landing page
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // To polyfill `global` and other globals.
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // To polyfill specific modules.
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
        // Keep asset names stable/`index.*` even though the entry html is
        // named `index-web.html`.
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
      // During local dev, forward /api/proxy to the local Go server.
      // In production, Vercel handles this route via api/proxy.go.
      // Run the local server with: go run api/local_server.go
      '/api/proxy': 'http://localhost:8787'
    }
  }
})
