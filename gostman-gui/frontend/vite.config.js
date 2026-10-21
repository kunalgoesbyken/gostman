import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {resolve, dirname} from 'path'
import {fileURLToPath} from 'url'
import {readFileSync} from 'fs'
import {siteDefine} from './site.config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const appVersion = JSON.parse(readFileSync(resolve(__dirname, '../wails.json'), 'utf8')).info.productVersion

export default defineConfig({
  define: {__APP_VERSION__: JSON.stringify(appVersion), ...siteDefine},
  plugins: [react()],
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
