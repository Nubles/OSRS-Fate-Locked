import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ALL_CA_TASKS } from '../data/caTasks';
import { OracleSearch } from './OracleSearch';
import { questId } from '../data/questCatalog';

const mockQuery = vi.hoisted(() => ({ current: 'Easy Tier' }));
const mockGame = vi.hoisted(() => ({
  current: {
    unlocks: {
      completedTasks: [] as string[],
      cas: [] as string[],
      regions: [] as string[],
      chunks: [] as string[],
      quests: [] as string[],
    },
    gameModeId: 'standard',
  },
}));

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState<T>(initial: T) {
      if (initial === '') return [mockQuery.current, vi.fn()];
      return actual.useState(initial);
    },
  };
});

vi.mock('../context/GameContext', () => ({
  useGame: () => mockGame.current,
}));

vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: () => undefined,
}));

vi.mock('./SectionGuide', () => ({
  SectionGuide: () => null,
}));

describe('OracleSearch Combat Achievement status', () => {
  it('shows canonical and normalized quest completions as completed', () => {
    mockQuery.current = 'Priest in Peril';
    for (const reference of [questId('Priest in Peril')!, ' PRIEST IN PERIL ']) {
      mockGame.current.unlocks.quests = [reference];
      const markup = renderToStaticMarkup(<OracleSearch onClose={vi.fn()} />);
      expect(markup).toContain('Completed');
      expect(markup).not.toContain('Not Started');
    }
  });
  it('shows a tier earned from current cumulative points as completed without a stored marker', () => {
    mockQuery.current = 'Easy Tier';
    mockGame.current.unlocks.completedTasks = ALL_CA_TASKS
      .filter(task => task.tierId === 'Easy')
      .map(task => task.id);
    mockGame.current.unlocks.cas = [];

    const markup = renderToStaticMarkup(<OracleSearch onClose={vi.fn()} />);

    expect(markup).toContain('Easy Tier');
    expect(markup).toContain('Completed');
    expect(markup).not.toContain('Locked');
  });
});

describe('OracleSearch overlap areas', () => {
  it("finds Otto's Grotto as the unlocked Baxtorian Falls area", () => {
    mockQuery.current = "Otto's Grotto";
    mockGame.current.unlocks.regions = ['Baxtorian Falls'];
    mockGame.current.unlocks.chunks = [];

    const markup = renderToStaticMarkup(<OracleSearch onClose={vi.fn()} />);

    expect(markup).toContain("Baxtorian Falls \u00b7 Otto&#x27;s Grotto");
    expect(markup).toContain('Unlocked');
    expect(markup).not.toContain('No fate found');
  });
});
