import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {resolve, dirname} from 'path'
import {fileURLToPath} from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
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
