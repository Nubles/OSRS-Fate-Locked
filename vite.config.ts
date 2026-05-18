
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
