import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import reactSourceLoc from './vite-plugin-react-source-loc';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  root: __dirname,
  plugins: [react(), reactSourceLoc(), tailwindcss()],

  server: {
    middlewareMode: true,
  },
  build: {
    outDir: path.resolve(__dirname, './dist'),
    emptyOutDir: true,
    // Emit source maps for dev builds only. The production bundle map is
    // ~10 MB which bumps against Databricks Apps' 10 MB per-file cap and
    // isn't needed at runtime.
    sourcemap: mode !== 'production',
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-dev-runtime', 'react/jsx-runtime', 'recharts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
