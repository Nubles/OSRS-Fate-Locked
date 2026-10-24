
import { defineConfig, normalizePath, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { configDefaults } from 'vitest/config';

// Minimal declaration so this Node-side config typechecks without pulling in
// @types/node (which would leak Node globals into the browser app code).
declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
};

// Each private preview module and the public-safe module a normal build uses instead.
const runeProofPreviewModules = new Map([
  ['questWalkthroughs', './questWalkthroughs.public'],
  ['questWalkthroughs.preview-boundary', './questWalkthroughs.public'],
  ['questItemRequirements.preview', './questItemRequirements.preview-omitted'],
]);

const runeProofPreviewBoundaryPlugin = (includePreview: boolean): Plugin => ({
  name: 'runeproof-preview-boundary',
  enforce: 'pre',
  resolveId(source, importer) {
    if (includePreview || !importer) return null;
    const normalizedSource = normalizePath(source).replace(/\.[cm]?[jt]sx?$/, '');
    const moduleId = normalizedSource.slice(normalizedSource.lastIndexOf('/') + 1);
    const publicModule = runeProofPreviewModules.get(moduleId);
    if (!publicModule) return null;
    return this.resolve(publicModule, importer, { skipSelf: true });
  },
});

// `base` controls the public path assets are served from. GitHub Pages project
// sites live at /<repo-name>/, so CI injects the real repo name via VITE_BASE.
export default defineConfig(({ mode }) => {
  const includeRuneProofPreview = mode === 'test' || mode === 'runeproof-preview';
  // CI and deploy builds stamp the commit SHA. Without one, a random id of the
  // same shape: the id is in the entry chunk, so a shorter or less random one
  // would make the entry budget check measure a smaller file than ships.
  const buildId = process.env.BUILD_ID
    || Array.from(crypto.getRandomValues(new Uint8Array(20)), (byte) => byte.toString(16).padStart(2, '0')).join('');

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
        exclude: [...configDefaults.exclude, '**/.worktrees/**', '**/output/**'],
        // Component tests draw the classic layout unless they pick the OSRS one
        // (UI_STYLE_KEY). The new-visitor default (OSRS) is pinned in
        // utils/uiStyle.test.ts, which unstubs this.
        env: { VITE_DEFAULT_UI_STYLE: 'classic' },
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
            // Eagerly-loaded game data. Lazy-only data must stay out of this
            // list or it would become part of the startup bundle.
            'game-data': [
              './data/questData.ts',
              './data/caTasks.ts',
              './data/diaryTasks.ts',
              './data/diaryData.ts',
              './data/areaAccess.ts',
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
