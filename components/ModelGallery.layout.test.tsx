// @vitest-environment jsdom
// browser[1]: on a phone the grey file-name caption ran past the window edge.
// It is hidden below the sm breakpoint and truncates inside its row above it.
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../hooks/useModelFor', () => ({ useModelManifest: () => true }));
vi.mock('../data/entityModels', () => ({
  loadedModelFiles: () => ({ 'abyssal-sire': 'abyssal-sire.gltf' }),
  modelUrlBySlug: () => null,
  orientationForSlug: () => undefined,
}));
vi.mock('./EntityModel', () => ({ EntityModel: () => null }));
vi.mock('../context/GameContext', () => ({ useGame: () => ({ animationsEnabled: false }) }));

import { ModelGallery } from './ModelGallery';

afterEach(cleanup);

describe('3D Model Gallery caption', () => {
  it('hides the file name on phones and keeps it inside its row', () => {
    const view = render(<ModelGallery onClose={() => {}} />);
    const caption = view.getByTestId('model-file');
    expect(caption.textContent).toBe('abyssal-sire.gltf');
    const classes = caption.className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(['hidden', 'sm:inline', 'truncate', 'min-w-0']));
    const row = caption.parentElement!;
    expect(row.className.split(/\s+/)).toContain('min-w-0');
    expect(row.querySelector('h3')!.textContent).toBe('Abyssal Sire');
  });
});
