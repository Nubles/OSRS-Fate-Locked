
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Minimal declaration so this Node-side config typechecks without pulling in
// @types/node (which would leak Node globals into the browser app code).
declare const process: { env: Record<string, string | undefined> };

// https://vitejs.dev/config/
//
// `base` controls the public path assets are served from. GitHub Pages project
// sites live at /<repo-name>/, so CI injects the real repo name via VITE_BASE
// (see .github/workflows/deploy.yml). Local dev/build falls back to '/'.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          // Stable vendor code — split out so it caches across app deploys.
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  }
});
