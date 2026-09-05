
import { defineConfig, normalizePath, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { configDefaults } from 'vitest/config';

// Minimal declaration so this Node-side config typechecks without pulling in
// @types/node (which would leak Node globals into the browser app code).
declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
};

const runeProofPreviewModuleIds = new Set([
  'questWalkthroughs',
  'questWalkthroughs.preview-boundary',
]);

const runeProofPreviewBoundaryPlugin = (includePreview: boolean): Plugin => ({
  name: 'runeproof-preview-boundary',
  enforce: 'pre',
  resolveId(source, importer) {
    if (includePreview || !importer) return null;
    const normalizedSource = normalizePath(source).replace(/\.[cm]?[jt]sx?$/, '');
    const moduleId = normalizedSource.slice(normalizedSource.lastIndexOf('/') + 1);
    if (!runeProofPreviewModuleIds.has(moduleId)) return null;
    return this.resolve('./questWalkthroughs.public', importer, { skipSelf: true });
  },
});

// `base` controls the public path assets are served from. GitHub Pages project
// sites live at /<repo-name>/, so CI injects the real repo name via VITE_BASE.
export default defineConfig(({ mode }) => {
  const includeRuneProofPreview = mode === 'test' || mode === 'runeproof-preview';
  const buildId = process.env.BUILD_ID || String(Date.now());

  return {
    plugins: [
      react(),
      runeProofPreviewBoundaryPlugin(includeRuneProofPreview),
      {
        name: 'emit-version-json',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: buildId }) });
        },
      },
    ],
    define: { __BUILD_ID__: JSON.stringify(buildId) },
    base: process.env.VITE_BASE || '/',
    ...{
      test: {
        setupFiles: ['./testSetup.ts'],
        exclude: [...configDefaults.exclude, '**/.worktrees/**', 'browser-tests/**'],
      },
    },
    build: {
      // Keep the existing browser target while updating the build tool's security fixes.
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          manualChunks: {
            // Stable vendor code — split out so it caches across app deploys.
            'react-vendor': ['react', 'react-dom'],
            // Eagerly-loaded game data. Lazy-only data must stay out of this
            // list or it would become part of the startup bundle.
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
    },
  };
});
