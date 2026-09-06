import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

// Vite copies public assets before writeBundle. Strip private data and artwork
// only from the build output; the source and private preview remain intact.
export const privateRuneProofAssets = (includePreview) => ({
  name: 'private-runeproof-assets',
  async writeBundle(output) {
    if (includePreview || !output.dir) return;
    const outputRoot = resolve(output.dir);
    if (outputRoot === resolve(process.cwd(), 'public')) {
      throw new Error('Build output must not overwrite the public source directory.');
    }
    await rm(resolve(outputRoot, 'runeproof'), { recursive: true, force: true });
  },
});
