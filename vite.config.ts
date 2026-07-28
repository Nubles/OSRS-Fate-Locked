
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { configDefaults } from 'vitest/config';

// Minimal declaration so this Node-side config typechecks without pulling in
// @types/node (which would leak Node globals into the browser app code).
declare const process: { env: Record<string, string | undefined> };

// Unique id for this build. CI passes the commit SHA via BUILD_ID; otherwise a
// timestamp. Baked into the bundle as __BUILD_ID__ AND written to version.json,
// so the running app can detect when a newer build has been deployed and offer
// a reload (see components/UpdateBanner.tsx).
const BUILD_ID = process.env.BUILD_ID || String(Date.now());

// https://vitejs.dev/config/
//
// `base` controls the public path assets are served from. GitHub Pages project
// sites live at /<repo-name>/, so CI injects the real repo name via VITE_BASE
// (see .github/workflows/deploy.yml). Local dev/build falls back to '/'.
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
      },
    },
  ],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  base: process.env.VITE_BASE || '/',
  ...{
    test: {
      exclude: [...configDefaults.exclude, '**/.worktrees/**'],
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          // Stable vendor code — split out so it caches across app deploys.
          'react-vendor': ['react', 'react-dom'],
          // Eagerly-loaded game data (quests, CAs, diaries, items). It loads at
          // startup either way, but in its own chunk it fetches in parallel
          // with the app code and — since the weekly content sync touches data
          // while features touch code — one changing no longer busts the
          // other's cache. Lazy-only data (requirements, collectionLogData,
          // resource*) must stay OUT of this list or it would become eager.
          'game-data': [
            './data/questData.ts',
            './data/caTasks.ts',
            './data/diaryTasks.ts',
            './data/diaryData.ts',
            './data/items.ts',
            './data/activityRequirements.ts',
            './data/assets.ts',
          ],
        },
      },
    },
  }
});
