// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OsrsSpendReveal from './OsrsSpendReveal';

vi.mock('../EntityModel', () => ({ EntityModel: () => null, preloadModelViewer: () => {} }));
vi.mock('../../data/entityModels', () => ({ loadModelManifest: () => Promise.resolve(), orientationFor: () => undefined }));
vi.mock('../../hooks/useModelFor', () => ({ useModelFor: () => null }));

afterEach(cleanup);

describe('OsrsSpendReveal', () => {
  it("shows a Key's cost, but none for Fate's Mercy or a Breakthrough", () => {
    const base = { itemName: 'Attack', itemType: 'Skills', onComplete: () => {}, animationsEnabled: false, tier: 2 };
    const paid = render(<OsrsSpendReveal {...base} />);
    expect(paid.container.textContent).toContain('-1 Key');
    paid.unmount();
    const mercy = render(<OsrsSpendReveal {...base} freeDraw="mercy" />);
    expect(mercy.container.textContent).not.toContain('-1');
    expect(mercy.container.textContent).toContain("Fate's Mercy");
    mercy.unmount();
    const breakthrough = render(<OsrsSpendReveal {...base} freeDraw="breakthrough" />);
    expect(breakthrough.container.textContent).not.toContain('-1');
    expect(breakthrough.container.textContent).toContain('Breakthrough');
  });
});
