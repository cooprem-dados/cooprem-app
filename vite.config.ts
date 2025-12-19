
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 'base' definido como './' garante que os caminhos dos assets sejam relativos.
  // Isso é essencial para o GitHub Pages (ex: usuario.github.io/repositorio/)
  base: './',
  plugins: [react()],
  define: {
    'process.env': process.env
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
