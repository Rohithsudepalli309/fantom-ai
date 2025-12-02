import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import type { ServerOptions } from 'node:https';

// Clean consolidated config:
// - Dev (serve): enable HTTPS with mkcert.
// - Build/preview: skip HTTPS/mkcert.
export default defineConfig(({ command, mode }) => {
  const dev = command === 'serve';
  const env = loadEnv(mode, process.cwd(), '');
  const sdTarget = (env.VITE_LOCAL_SD || 'http://127.0.0.1:7860').replace(/\/$/, '');
  const devHttps = String(env.VITE_DEV_HTTPS || 'true').toLowerCase() !== 'false';
  return {
    server: dev
      ? {
        port: 3000,
        host: '0.0.0.0',
        https: devHttps ? ({} as ServerOptions) : undefined,
        proxy: {
          '/api': {
            target: 'http://127.0.0.1:4000',
            changeOrigin: true,
            secure: false,
            rewrite: (p) => p,
          },
          '/sdapi': {
            target: sdTarget,
            changeOrigin: true,
            secure: false,
            // keep full /sdapi prefix so upstream sees /sdapi/v1/...
            rewrite: (path) => path,
          },
          '/stability': {
            target: 'https://api.stability.ai',
            changeOrigin: true,
            secure: true,
            rewrite: (path) => path.replace(/^\/stability/, ''),
          },
        },
      }
      : undefined,
    plugins: dev ? (devHttps ? [react(), mkcert()] : [react()]) : [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
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
              if (id.includes('@supabase')) return 'supabase';
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
