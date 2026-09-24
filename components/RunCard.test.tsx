import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunCardModal } from './RunCard';
import { auditHistory, ensureChain } from '../utils/integrity';
import type { LogEntry } from '../types';

const mockGame = vi.hoisted(() => ({
  current: {
    history: [] as LogEntry[],
    unlocks: {
      regions: [] as string[],
      chunks: [] as string[],
    },
    keys: 0,
    specialKeys: 0,
    chaosKeys: 0,
    fatePoints: 0,
    gameModeId: 'vanilla',
  },
}));

vi.mock('../context/GameContext', () => ({
  useGame: () => mockGame.current,
}));

vi.mock('../context/ProfileContext', () => ({
  useProfiles: () => ({ activeProfileName: 'Alias debt fixture' }),
}));

vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: () => undefined,
}));

describe('RunCardModal region total', () => {
  it.each([
    {
      label: 'pending overlap refund credits',
      regions: ['Baxtorian Falls', "Otto's Grotto", 'Taverley', "Heroes' Guild"],
      expected: '11/187 regions',
    },
    {
      label: 'ordinary canonical regions',
      regions: ['Baxtorian Falls', 'Taverley'],
      expected: '11/187 regions',
    },
  ])('shows $expected for $label', ({ regions, expected }) => {
    mockGame.current.unlocks.regions = regions;

    const markup = renderToStaticMarkup(<RunCardModal onClose={vi.fn()} embedded />);

    expect(markup).toContain(expected);
    expect(markup).not.toContain("Otto's Grotto");
    expect(markup).not.toContain("Heroes' Guild");
  });
});

describe('RunCardModal local history status', () => {
  const entry = (changes: Partial<LogEntry> = {}): LogEntry => ({
    id: 'vanilla-roll', timestamp: 1_700_000_000_000,
    type: 'ROLL_SUCCESS', message: 'Key Found!', ...changes,
  });
  const renderCard = () => renderToStaticMarkup(<RunCardModal onClose={vi.fn()} embedded />);

  beforeEach(() => {
    mockGame.current.history = [];
    mockGame.current.unlocks.regions = [];
    mockGame.current.gameModeId = 'vanilla';
  });

  it('does not approve an impossible replay just because its hashes are valid', () => {
    mockGame.current.history = ensureChain([entry({
      type: 'UNLOCK', message: 'Unlocked without earning a key',
      meta: { costType: 'key', cost: 4 },
    })]);
    const audit = auditHistory(mockGame.current.history);
    expect(audit.chain.ok).toBe(true);
    expect(audit.verdict).toBe('warning');
    expect(audit.violations.some(warning => warning.kind === 'KEYS_NEGATIVE')).toBe(true);

    const markup = renderCard();
    expect(markup).toContain('REPLAY WARNING');
    expect(markup).not.toContain('HISTORY CHECKED');
    expect(markup).not.toContain('VERIFIED');
    expect(markup).toContain('1 replay warning');
  });

  it('labels a valid Vanilla history as a local check rather than external verification', () => {
    mockGame.current.history = ensureChain([entry()]);
    expect(auditHistory(mockGame.current.history).verdict).toBe('verified');

    const markup = renderCard();
    expect(markup).toContain('HISTORY CHECKED');
    expect(markup).toContain('not external verification');
    expect(markup).not.toContain('VERIFIED');
    expect(markup).not.toContain('REPLAY WARNING');
  });

  it("checks a pity-off run's Fate against its own mode", () => {
    // Legacy Hardcore has no pity: 30 failures at +2 legitimately reach 60 Fate.
    mockGame.current.gameModeId = 'hardcore';
    mockGame.current.history = ensureChain(Array.from({ length: 30 }, (_, index) => entry({
      id: `hardcore-fail-${index}`, type: 'ROLL_FAIL', message: 'No Key.',
      meta: { fatePointsEarned: 2 },
    })));

    const markup = renderCard();
    expect(markup).toContain('HISTORY CHECKED');
    expect(markup).not.toContain('REPLAY WARNING');
  });

  it('keeps broken hashes distinct from a replay warning', () => {
    const [chained] = ensureChain([entry()]);
    mockGame.current.history = [{ ...chained, message: 'Changed after hashing' }];
    expect(auditHistory(mockGame.current.history).verdict).toBe('tampered');

    const markup = renderCard();
    expect(markup).toContain('BROKEN HISTORY');
    expect(markup).toContain('1 broken link');
    expect(markup).not.toContain('HISTORY CHECKED');
  });

  it('does not report an empty history as checked', () => {
    const markup = renderCard();
    expect(markup).toContain('NO HISTORY');
    expect(markup).toContain('No recorded history to check');
    expect(markup).not.toContain('HISTORY CHECKED');
  });
});
