import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { questId } from '../data/questCatalog';
import { ActionSection } from './ActionSection';

const state = vi.hoisted(() => ({ quests: [] as string[] }));
vi.mock('../context/GameContext', () => ({ useGame: () => ({
  unlocks: { quests: state.quests, bosses: [], regions: [] },
  gameModeId: 'standard', rollForKey: vi.fn(), animationsEnabled: false,
}) }));

describe('Slayer master identity display', () => {
  it('uses the post-quest masters for canonical IDs and normalized aliases', () => {
    for (const quests of [
      [questId('While Guthix Sleeps')!, questId('Monkey Madness II')!],
      [' WHILE GUTHIX SLEEPS ', 'monkey madness ii'],
    ]) {
      state.quests = quests;
      const markup = renderToStaticMarkup(<ActionSection />);
      expect(markup).toContain('Aya');
      expect(markup).toContain('Kuradal');
      expect(markup).toContain('Steve');
      expect(markup).not.toContain('Turael');
      expect(markup).not.toContain('Nieve');
      expect(markup).not.toContain('Duradel');
    }
    state.quests = [];
    const markup = renderToStaticMarkup(<ActionSection />);
    expect(markup).toContain('Turael');
    expect(markup).toContain('Nieve');
    expect(markup).toContain('Duradel');
  });
});
