import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('mermaid')) {
            return 'preview-vendor';
          }

          if (id.includes('@google/genai')) {
            return 'ai-vendor';
          }

          if (id.includes('docx')) {
            return 'docx-vendor';
          }

          if (id.includes('pptxgenjs')) {
            return 'pptx-vendor';
          }

          if (id.includes('lucide-react')) {
            return 'icons-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
