import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import type { ServerOptions } from 'node:https';

// Clean consolidated config:
// - Dev (serve): enable HTTPS with mkcert.
// - Build/preview: skip HTTPS/mkcert.
export default defineConfig(({ command }) => {
  const dev = command === 'serve';
  return {
    server: dev
      ? {
          port: 3000,
          host: '0.0.0.0',
          https: {} as ServerOptions,
        }
      : undefined,
    plugins: dev ? [react(), mkcert()] : [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
              if (id.includes('react-markdown') || id.includes('remark-gfm')) return 'markdown';
              if (id.includes('firebase')) return 'firebase';
              if (id.includes('@supabase')) return 'supabase';
              if (id.includes('@google/genai')) return 'genai';
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
