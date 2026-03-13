import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), visualizer({ open: false, filename: 'dist/bundle-report.html', gzipSize: true })],
  optimizeDeps: {
    include: ['mammoth'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react/jsx-runtime'],
          'vendor-motion': ['framer-motion'],
'vendor-d3': ['d3'],
          'vendor-icons': ['lucide-react'],
          'vendor-mammoth': ['mammoth'],
          'vendor-utils': [
            'zustand',
            'jszip',
            'xlsx',
          ],
        },
      },
    },
  },
})
