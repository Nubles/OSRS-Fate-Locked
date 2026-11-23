// @vitest-environment jsdom
// Esc on a ritual's full-screen scene closes the scene only, not the Void Altar under it.
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEscapeKey } from '../hooks/useEscapeKey';

const player = vi.hoisted(() => ({ destroy: vi.fn(), skip: vi.fn() }));
vi.mock('./rituals/ritualAssets', () => ({ loadRitualFonts: () => Promise.resolve() }));
vi.mock('./rituals/ritualScenes', () => ({ RITUAL_SCENES: {} }));
vi.mock('./rituals/ritualStage', () => ({ playScene: () => player }));

import { RitualAnimation } from './RitualAnimation';

afterEach(() => { cleanup(); player.destroy.mockReset(); });

const Altar: React.FC<{ onClose: () => void }> = ({ onClose }) => { useEscapeKey(onClose); return null; };

describe('Esc on a ritual scene', () => {
  it('closes the scene and leaves the Void Altar open', async () => {
    const closeAltar = vi.fn();
    render(<><Altar onClose={closeAltar} /><RitualAnimation ritual="LUCK" meta={{}} ownedChunks={[]} onComplete={vi.fn()} /></>);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(player.destroy).toHaveBeenCalledTimes(1);
    expect(closeAltar).not.toHaveBeenCalled();
  });
});
