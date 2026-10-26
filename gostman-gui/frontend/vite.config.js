import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {resolve, dirname} from 'path'
import {fileURLToPath} from 'url'
import {siteDefine} from './site.config.js'
import {localesPlugin} from './i18n/plugin.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  define: siteDefine,
  plugins: [react(), localesPlugin()],
  cacheDir: 'node_modules/.vite-desktop',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
  esbuild: {
    target: 'es2022'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022'
    }
  }
})
