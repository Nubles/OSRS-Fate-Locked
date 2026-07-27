import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider } from '../context/GameContext';
import { ReferenceModal } from './ReferenceModal';

type CodexTab = 'economy' | 'drops' | 'unlocks';

const renderCodex = (tab: CodexTab, gameModeId = 'vanilla') => {
  const save = JSON.stringify({ gameModeId });
  vi.stubGlobal('localStorage', {
    getItem: () => save,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  });

  return renderToStaticMarkup(
    <GameProvider storageKey="reference-modal-test">
      <ReferenceModal onClose={() => undefined} {...({ initialTab: tab } as {})} />
    </GameProvider>,
  );
};

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('ReferenceModal Vanilla policy', () => {
  it('documents the finite reserve, schedules, access safety valve, and scattered named areas in their existing tabs', () => {
    const economy = renderCodex('economy');
    const drops = renderCodex('drops');
    const unlocks = renderCodex('unlocks');

    expect(economy).toContain('116 finite boss safety-reserve Standard Keys');
    expect(drops).toContain('Brutus: 10% (1 key)');
    expect(drops).toContain('Low: 15% (1 key)');
    expect(drops).toContain('Mid: 30% → 15% (2 keys)');
    expect(drops).toContain('High: 50% → 25% (2 keys)');
    expect(drops).toContain('Raid: 65% → 32.5% → 16.25% (3 keys)');
    expect(drops).toContain('25% → 15% → 10%');
    expect(unlocks).toContain('Standard and Chaos random unlocks respect hard location access');
    expect(unlocks).toContain('empty eligible pool means no unlock occurs');
    expect(unlocks).toContain('Omni-Key direct unlocks bypass that filter with a warning');
    expect(unlocks).toContain('Vanilla named-area rolls can be scattered');
    expect(unlocks).toContain('Only Chunked mode enforces adjacent expansion');
  });

  it('labels the Vanilla policy as inactive outside Vanilla', () => {
    expect(renderCodex('economy', 'chunked')).toContain('Vanilla-only (not active for this run)');
  });
});
