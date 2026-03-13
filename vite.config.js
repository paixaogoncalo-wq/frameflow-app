import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
