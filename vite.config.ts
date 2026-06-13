import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === 'production'
      ? [
          {
            name: 'cep-html-transform',
            transformIndexHtml: {
              order: 'post' as const,
              handler(html: string) {
                return html.replace(/type="module"\s+/g, '').replace(/type='module'\s+/g, '');
              },
            },
          } as Plugin,
        ]
      : []),
  ],
  base: './',
  build: {
    target: 'es2015',
    minify: false,
    sourcemap: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        manualChunks: undefined,
        assetFileNames: 'assets/[name]-[hash][extname]',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
}));
