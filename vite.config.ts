import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // IMPORTANTE: nome EXATO do repositório no GitHub Pages
  base: '/cooprem-app/',

  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: [
            'react',
            'react-dom',
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
          ],
          utils: ['exceljs', 'jspdf', 'jspdf-autotable'],
        },
      },
    },
  },
})