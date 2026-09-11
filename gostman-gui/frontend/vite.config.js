import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {resolve, dirname} from 'path'
import {fileURLToPath} from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Desktop (Wails) config.
// Explicit entry: index.html -> src/main.jsx -> App.jsx (uses Wails bindings).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022', // Support top-level await (required by curlconverter)
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
  esbuild: {
    target: 'es2022' // Also apply to dev mode
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022'
    }
  }
})
