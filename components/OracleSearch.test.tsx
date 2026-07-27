import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ALL_CA_TASKS } from '../data/caTasks';
import { OracleSearch } from './OracleSearch';

const mockGame = vi.hoisted(() => ({
  current: {
    unlocks: {
      completedTasks: [] as string[],
      cas: [] as string[],
    },
    gameModeId: 'standard',
  },
}));

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState<T>(initial: T) {
      if (initial === '') return ['Easy Tier', vi.fn()];
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
  it('shows a tier earned from current cumulative points as completed without a stored marker', () => {
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
